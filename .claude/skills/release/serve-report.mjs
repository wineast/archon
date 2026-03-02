#!/usr/bin/env node
/**
 * Release Report Viewer（独立版）
 * 集成链路：集成报告 → 发布检查
 *
 * 功能：双栏 Tab 切换、Verdict 横幅、截图内联、Markdown 渲染
 * 依赖：仅 Node.js 标准库，marked.js 从 CDN 加载
 *
 * Usage: node .claude/skills/release/serve-report.mjs
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, createReadStream, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const ROOT = resolve(process.cwd(), ".release");
const REPORTS = [
  { key: "integrate", path: "INTEGRATE.md", label: "集成报告" },
  { key: "release", path: "RELEASE_REPORT.md", label: "发布检查" },
];
const DEFAULT_TAB = "release";
const VERDICT_SOURCE = "release";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

// ── 读取报告 Markdown ──────────────────────────────
function loadReports() {
  const data = {};
  for (const r of REPORTS) {
    const fp = join(ROOT, r.path);
    data[r.key] = existsSync(fp) ? readFileSync(fp, "utf-8") : null;
  }
  return data;
}

// ── HTML 页面 ──────────────────────────────────────
function buildHTML(reports) {
  const tabs = REPORTS.map((r) => {
    const exists = reports[r.key] !== null;
    const active = r.key === DEFAULT_TAB ? "active" : "";
    return `<button class="tab ${active}" data-key="${r.key}" ${exists ? "" : "disabled"}>${r.label}${exists ? "" : " (缺失)"}</button>`;
  }).join("");

  const panels = REPORTS.map((r) => {
    const hidden = r.key === DEFAULT_TAB ? "" : "hidden";
    const content = reports[r.key] || "";
    return `<div class="panel" id="panel-${r.key}" ${hidden}><div class="md-source" style="display:none">${escapeHTML(content)}</div><div class="md-render"></div></div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>发布检查报告</title>
<style>
  :root { --bg: #fff; --fg: #1a1a1a; --muted: #666; --border: #e5e5e5; --accent: #2563eb; --pass: #16a34a; --warn: #d97706; --fail: #dc2626; --code-bg: #f5f5f5; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0a0a0a; --fg: #e5e5e5; --muted: #999; --border: #2a2a2a; --accent: #60a5fa; --pass: #4ade80; --warn: #fbbf24; --fail: #f87171; --code-bg: #1a1a1a; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.6; }

  /* chain indicator */
  .chain { display: flex; align-items: center; gap: 8px; padding: 12px 24px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--muted); }
  .chain-step { padding: 2px 10px; border-radius: 12px; background: var(--border); font-weight: 500; }
  .chain-step.available { background: var(--accent); color: #fff; }
  .chain-arrow { font-size: 11px; }

  /* verdict banner */
  .verdict-banner { padding: 10px 24px; font-weight: 600; font-size: 14px; display: none; }
  .verdict-banner.pass { display: block; background: color-mix(in srgb, var(--pass) 15%, transparent); color: var(--pass); }
  .verdict-banner.warn { display: block; background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
  .verdict-banner.fail { display: block; background: color-mix(in srgb, var(--fail) 15%, transparent); color: var(--fail); }

  /* tabs */
  .tab-bar { display: flex; gap: 0; border-bottom: 1px solid var(--border); padding: 0 24px; }
  .tab { padding: 10px 20px; border: none; background: none; cursor: pointer; font-size: 14px; color: var(--muted); border-bottom: 2px solid transparent; transition: all .15s; }
  .tab:hover:not([disabled]) { color: var(--fg); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 500; }
  .tab[disabled] { opacity: .4; cursor: not-allowed; }

  /* panels */
  .panel { padding: 24px; max-width: 900px; margin: 0 auto; }
  .panel[hidden] { display: none; }

  /* markdown */
  .md-render h1 { font-size: 1.6em; margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  .md-render h2 { font-size: 1.3em; margin: 28px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
  .md-render h3 { font-size: 1.1em; margin: 20px 0 6px; }
  .md-render p { margin: 8px 0; }
  .md-render ul, .md-render ol { margin: 8px 0; padding-left: 24px; }
  .md-render li { margin: 4px 0; }
  .md-render blockquote { margin: 8px 0; padding: 8px 16px; border-left: 3px solid var(--accent); color: var(--muted); background: var(--code-bg); border-radius: 0 4px 4px 0; }
  .md-render code { font-family: "SF Mono", Menlo, monospace; font-size: 0.9em; padding: 2px 5px; background: var(--code-bg); border-radius: 3px; }
  .md-render pre { margin: 12px 0; padding: 14px; background: var(--code-bg); border-radius: 6px; overflow-x: auto; }
  .md-render pre code { padding: 0; background: none; }
  .md-render table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  .md-render th, .md-render td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; }
  .md-render th { background: var(--code-bg); font-weight: 600; }
  .md-render img { max-width: 100%; border-radius: 6px; margin: 8px 0; border: 1px solid var(--border); }
  .md-render strong { font-weight: 600; }
  .md-render a { color: var(--accent); text-decoration: none; }
  .md-render a:hover { text-decoration: underline; }
  .md-render hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }

  /* checkbox list */
  .md-render li input[type="checkbox"] { margin-right: 6px; }
</style>
</head>
<body>

<div class="chain" id="chain"></div>
<div class="verdict-banner" id="verdict"></div>
<div class="tab-bar">${tabs}</div>
${panels}

<script src="https://cdn.jsdelivr.net/npm/marked@15/marked.min.js"></script>
<script>
(function() {
  const REPORTS = ${JSON.stringify(REPORTS.map((r) => ({ key: r.key, label: r.label })))};
  const VERDICT_SOURCE = ${JSON.stringify(VERDICT_SOURCE)};

  // ── chain indicator ──
  const chainEl = document.getElementById("chain");
  const available = new Set();
  document.querySelectorAll(".panel").forEach(p => {
    const src = p.querySelector(".md-source");
    if (src && src.textContent.trim()) available.add(p.id.replace("panel-", ""));
  });
  chainEl.innerHTML = REPORTS.map((r, i) => {
    const cls = available.has(r.key) ? "chain-step available" : "chain-step";
    const arrow = i < REPORTS.length - 1 ? '<span class="chain-arrow">→</span>' : "";
    return '<span class="' + cls + '">' + r.label + "</span>" + arrow;
  }).join("");

  // ── render markdown ──
  document.querySelectorAll(".panel").forEach(panel => {
    const src = panel.querySelector(".md-source");
    const render = panel.querySelector(".md-render");
    if (!src || !src.textContent.trim()) {
      render.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">报告文件缺失</p>';
      return;
    }
    let html = marked.parse(src.textContent);
    // rewrite image paths: relative assets → /assets/
    html = html.replace(/src="([^"]*?\\.assets\\/[^"]*)"/g, (_, p) => 'src="/assets/' + p + '"');
    render.innerHTML = html;
  });

  // ── verdict banner ──
  const verdictPanel = document.getElementById("panel-" + VERDICT_SOURCE);
  if (verdictPanel) {
    const verdictEl = document.getElementById("verdict");
    const render = verdictPanel.querySelector(".md-render");
    const h2s = render.querySelectorAll("h2");
    for (const h2 of h2s) {
      if (/verdict|裁定/i.test(h2.textContent)) {
        // 只取"判决"小节的文本（到下一个 h3 为止）
        let judgeText = "";
        let el = h2.nextElementSibling;
        while (el && el.tagName !== "H2") {
          if (el.tagName === "H3" && /判决/.test(el.textContent)) {
            el = el.nextElementSibling;
            while (el && el.tagName !== "H3" && el.tagName !== "H2") { judgeText += el.textContent + " "; el = el.nextElementSibling; }
            break;
          }
          el = el.nextElementSibling;
        }
        if (!judgeText) { // fallback: 用整个 verdict 区块
          el = h2.nextElementSibling;
          while (el && el.tagName !== "H2") { judgeText += el.textContent + " "; el = el.nextElementSibling; }
        }
        if (/✅/.test(judgeText)) { verdictEl.className = "verdict-banner pass"; verdictEl.textContent = "✅ 可以发布"; }
        else if (/⚠️|有条件/.test(judgeText)) { verdictEl.className = "verdict-banner warn"; verdictEl.textContent = "⚠️ 有条件发布"; }
        else if (/❌|阻塞|驳回/.test(judgeText)) { verdictEl.className = "verdict-banner fail"; verdictEl.textContent = "❌ 阻塞发布"; }
        else { verdictEl.className = "verdict-banner pass"; verdictEl.textContent = "✅ 可以发布"; }
        break;
      }
    }
  }

  // ── tab switching ──
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.hidden = true);
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.key).hidden = false;
    });
  });
})();
</script>
</body>
</html>`;
}

function escapeHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── HTTP Server ────────────────────────────────────
function start() {
  if (!existsSync(join(ROOT, "RELEASE_REPORT.md"))) {
    console.error("错误：.release/RELEASE_REPORT.md 不存在，请先运行 /release 生成报告");
    process.exit(1);
  }

  const reports = loadReports();
  const html = buildHTML(reports);

  const server = createServer((req, res) => {
    // asset serving: /assets/RELEASE_REPORT.assets/xxx.png
    if (req.url.startsWith("/assets/")) {
      const relPath = decodeURIComponent(req.url.slice("/assets/".length));
      // prevent traversal
      if (relPath.includes("..")) { res.writeHead(403); res.end(); return; }
      const absPath = join(ROOT, relPath);
      if (!existsSync(absPath)) { res.writeHead(404); res.end("Not found"); return; }
      const ext = extname(absPath).toLowerCase();
      const mime = MIME[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      createReadStream(absPath).pipe(res);
      return;
    }

    // main page
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(0, () => {
    const port = server.address().port;
    const url = `http://localhost:${port}`;
    console.log(`\n  发布检查报告查看器已启动：${url}\n`);
    // try open browser
    import("node:child_process").then(({ exec }) => {
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${cmd} ${url}`);
    });
  });
}

start();
