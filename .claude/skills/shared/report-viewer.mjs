#!/usr/bin/env node
/**
 * Shared Report Viewer
 * Configurable Web Viewer for report chains. Zero external dependencies.
 *
 * Config:
 *   reports:       [{ key, path, label, badge?, optional? }]
 *   chain:         [{ key, label, cssClass, optional? }]
 *   defaultTab:    "last" | "<key>"
 *   requiredFile:  filename to validate at startup (e.g. "VERIFY_REPORT.md")
 *   verdictSource: key of the tab to extract verdict from
 *   actions:       boolean — enable merge/delete UI
 *
 * Usage:
 *   import { startViewer } from "../shared/report-viewer.mjs";
 *   startViewer({ reports: [...], chain: [...], ... });
 */

import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  statSync,
  createReadStream,
  watch,
} from "node:fs";
import { join, extname, resolve } from "node:path";
import { spawn, execSync } from "node:child_process";

// ── Default verdict keywords ───────────────────────────────────────────
const VERDICT_FAIL_KW = ["驳回", "不足", "❌"];
const VERDICT_WARN_KW = ["有条件", "部分", "⚠️"];

// ── Public API ─────────────────────────────────────────────────────────

export function startViewer(config) {
  const CWD = process.cwd();
  const WT_DIR = join(CWD, ".worktree");
  const META = join(WT_DIR, "meta.json");
  const MSH = join(WT_DIR, "merge.sh");
  const VIEWER_JSON = join(WT_DIR, ".viewer.json");

  const rd = (p) => {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      return null;
    }
  };

  /* ── Idempotent start: check if viewer is already running ──── */

  if (existsSync(VIEWER_JSON)) {
    try {
      const prev = JSON.parse(rd(VIEWER_JSON));
      if (prev.pid) {
        // Check if process is alive
        process.kill(prev.pid, 0); // throws if dead
        const url = `http://localhost:${prev.port}`;
        console.log(`Report Viewer already running: ${url} (pid ${prev.pid})`);
        process.exit(0);
      }
    } catch {
      // Process dead or bad JSON — clean up stale file
      try {
        unlinkSync(VIEWER_JSON);
      } catch {}
    }
  }

  /* ── Startup validation ─────────────────────────────────────── */

  if (config.requiredFile && !existsSync(join(WT_DIR, config.requiredFile))) {
    console.error(`Error: .worktree/${config.requiredFile} not found.`);
    process.exit(1);
  }

  /* ── Branch / worktree info ─────────────────────────────────── */

  let baseBranch, currentBranch, mainRepo = CWD, wtName = "";

  if (existsSync(META)) {
    try {
      baseBranch = JSON.parse(rd(META)).baseBranch;
    } catch {}
  }

  try {
    currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: CWD,
      encoding: "utf-8",
    }).trim();
  } catch {}

  if (!baseBranch) baseBranch = "main";

  // Parse merge.sh for MAIN_REPO and WT_NAME
  if (existsSync(MSH)) {
    const c = rd(MSH);
    const mr = c.match(/^MAIN_REPO="(.+)"$/m);
    const wn = c.match(/^WT_NAME="(.+)"$/m);
    if (mr) mainRepo = mr[1];
    if (wn) wtName = wn[1];
  }

  // Fallback: derive wtName from CWD path
  if (!wtName) {
    const m = CWD.match(/\.worktrees[/\\]([^/\\]+)$/);
    if (m) wtName = m[1];
  }

  // Fallback: derive mainRepo from git common dir
  if (mainRepo === CWD && wtName) {
    try {
      const gcd = execSync("git rev-parse --git-common-dir", {
        cwd: CWD,
        encoding: "utf-8",
      }).trim();
      mainRepo = resolve(CWD, gcd, "..");
    } catch {}
  }

  // Find upstream worktree path
  let upstreamPath = mainRepo;
  try {
    const raw = execSync("git worktree list --porcelain", {
      cwd: CWD,
      encoding: "utf-8",
    });
    for (const entry of raw.split("\n\n").filter(Boolean)) {
      const lines = entry.split("\n");
      const pl = lines.find((l) => l.startsWith("worktree "));
      const bl = lines.find((l) => l.startsWith("branch "));
      if (pl && bl) {
        const sb = bl.replace("branch ", "").replace("refs/heads/", "");
        if (sb === baseBranch) {
          upstreamPath = pl.replace("worktree ", "");
          break;
        }
      }
    }
  } catch {}

  const pageTitle = wtName || currentBranch || "viewer";
  const showActions = config.actions && !!wtName;

  /* ── State ──────────────────────────────────────────────────── */

  let mergeState = "idle";
  let deleteState = "idle";

  /* ── SSE helper ─────────────────────────────────────────────── */

  function sseExec(command, args, options, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const send = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    child.stdout.on("data", (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (line) send("stdout", line);
      }
    });

    child.stderr.on("data", (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (line) send("stderr", line);
      }
    });

    child.on("close", (code) => {
      send("exit", code);
      res.end();
    });

    child.on("error", (err) => {
      send("error", err.message);
      res.end();
    });

    res.on("close", () => {
      child.kill();
    });

    return child;
  }

  /* ── Available reports (skip optional if file missing) ──────── */

  function getAvailable() {
    return config.reports.filter(
      (r) => !r.optional || existsSync(join(WT_DIR, r.path))
    );
  }

  /* ── SSE file-watch: push changes to connected browsers ────── */

  const sseClients = new Set();

  let watchDebounce = null;
  try {
    watch(WT_DIR, (eventType, filename) => {
      if (!filename || !filename.endsWith(".md")) return;
      if (watchDebounce) clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        const msg = `data: ${JSON.stringify({ type: "file-change", file: filename })}\n\n`;
        for (const client of sseClients) {
          try {
            client.write(msg);
          } catch {
            sseClients.delete(client);
          }
        }
      }, 500);
    });
  } catch {
    // fs.watch may fail on some systems; viewer still works, just no auto-refresh
  }

  /* ── Build HTML ─────────────────────────────────────────────── */

  function buildHtml() {
    const rpts = getAvailable();
    const data = {};
    for (const r of rpts) data[r.key] = rd(join(WT_DIR, r.path)) || "";

    // Default tab
    const defTab =
      config.defaultTab === "last"
        ? rpts[rpts.length - 1]?.key
        : config.defaultTab;

    // Available chain nodes (skip optional if report missing)
    const chains = config.chain.filter(
      (c) => !c.optional || rpts.some((r) => r.key === c.key)
    );

    // ─ Chain flow HTML ─
    const availKeys = new Set(rpts.map((r) => r.key));
    const chainHtml = chains
      .map(
        (c, i) =>
          `<span class="chain-node ${c.cssClass}${availKeys.has(c.key) ? "" : " dimmed"}">${c.label}</span>` +
          (i < chains.length - 1
            ? '\n    <span class="chain-arrow">\u2192</span>'
            : "")
      )
      .join("\n    ");

    // ─ Tab bar HTML ─
    const tabBarHtml = rpts
      .map(
        (r, i) =>
          `<button class="tab-btn${r.key === defTab ? " active" : ""}" data-tab="${r.key}" onclick="switchTab('${r.key}')">` +
          `\n      <span class="tab-badge ${r.badge || r.key}">${i + 1}</span> ${r.label}` +
          `\n    </button>`
      )
      .join("\n    ");

    // ─ Tab panels HTML ─
    const panelsHtml = rpts
      .map(
        (r) =>
          `<div class="tab-panel${r.key === defTab ? " active" : ""}" id="panel-${r.key}">` +
          `\n    <div class="panel-body" id="content-${r.key}"></div>` +
          `\n  </div>`
      )
      .join("\n  ");

    // ─ Actions HTML (conditional) ─
    const actionsHtml = showActions
      ? `
  <!-- Actions -->
  <div class="actions" id="actions-area">
    <div class="actions-header">
      <span class="actions-title">Actions</span>
      <span id="merge-status"></span>
      <span id="delete-status"></span>
    </div>
    <div class="wt-status" id="wt-status">
      <div class="wt-card">
        <div class="wt-card-header">\u2191 Upstream</div>
        <div class="wt-card-branch" id="wt-upstream-branch">...</div>
        <div class="wt-card-meta" id="wt-upstream-meta"></div>
      </div>
      <div class="wt-card">
        <div class="wt-card-header">\u25CF Current</div>
        <div class="wt-card-branch" id="wt-current-branch">...</div>
        <div class="wt-card-meta" id="wt-current-meta"></div>
      </div>
    </div>
    <div id="commits-section" style="display:none">
      <div class="commits-header">
        <span class="commits-title">Commits</span>
        <span class="commits-count" id="commits-count"></span>
      </div>
      <div class="commits-list" id="commits-list"></div>
      <details class="diff-stat-details" id="diff-stat-wrap" style="display:none">
        <summary class="diff-stat-summary">Changed files</summary>
        <pre class="diff-stat-content" id="diff-stat-content"></pre>
      </details>
    </div>
    <div class="merge-check checking" id="merge-check">Checking...</div>
    <div class="btn-group">
      <div id="btn-merge-wrap">
        <button class="btn btn-merge" id="btn-merge" onclick="doMerge()" disabled>Merge to upstream</button>
      </div>
      <div id="btn-delete-wrap" style="display:none">
        <button class="btn btn-delete" id="btn-delete" onclick="doDelete()">Delete worktree</button>
      </div>
    </div>
    <div class="terminal" id="terminal">
      <div class="terminal-content" id="terminal-content"></div>
    </div>
  </div>`
      : "";

    // ─ Actions client JS (conditional) ─
    const actionsJs = showActions
      ? `
  // --- DOM refs ---
  const mergeCheckEl = document.getElementById("merge-check");
  const terminal = document.getElementById("terminal");
  const termContent = document.getElementById("terminal-content");
  const btnMerge = document.getElementById("btn-merge");
  const btnDelete = document.getElementById("btn-delete");
  const deleteWrap = document.getElementById("btn-delete-wrap");
  const mergeStatus = document.getElementById("merge-status");

  // --- Status helpers ---
  function statusBadges(data) {
    let b = "";
    if (data.staged > 0) b += '<span class="wt-badge staged">' + data.staged + ' staged</span>';
    if (data.unstaged > 0) b += '<span class="wt-badge dirty">' + data.unstaged + ' modified</span>';
    if (data.untracked > 0) b += '<span class="wt-badge untracked">' + data.untracked + ' untracked</span>';
    if (data.staged === 0 && data.unstaged === 0 && data.untracked === 0) b += '<span class="wt-badge clean">Clean</span>';
    if (data.ahead > 0) b += '<span class="wt-badge ahead">\\u2191' + data.ahead + ' ahead</span>';
    if (data.behind > 0) b += '<span class="wt-badge behind">\\u2193' + data.behind + ' behind</span>';
    return b;
  }
  function isDirty(s) { return s && (s.staged > 0 || s.unstaged > 0 || s.untracked > 0); }

  function refreshState() {
    if (!document.getElementById("actions-area").offsetParent) return;
    mergeCheckEl.className = "merge-check checking";
    mergeCheckEl.textContent = "Checking...";
    btnMerge.disabled = true;

    fetch("/status").then(r => r.json()).then(data => {
      if (data.upstream) {
        document.getElementById("wt-upstream-branch").textContent = data.upstream.branch || "?";
        document.getElementById("wt-upstream-meta").innerHTML = statusBadges(data.upstream);
      }
      if (data.current) {
        document.getElementById("wt-current-branch").textContent = data.current.branch || "?";
        document.getElementById("wt-current-meta").innerHTML = statusBadges(data.current);
      }

      // Render commits
      var commitsSection = document.getElementById("commits-section");
      var commitsList = document.getElementById("commits-list");
      var commitsCount = document.getElementById("commits-count");
      if (data.commits && data.commits.length > 0) {
        commitsSection.style.display = "";
        commitsCount.textContent = data.commits.length;
        commitsList.innerHTML = data.commits.map(function(c) {
          return '<div class="commit-row">' +
            '<span class="commit-hash">' + c.hash + '</span>' +
            '<span class="commit-subject">' + c.subject.replace(/</g, "&lt;") + '</span>' +
            '<span class="commit-meta"><span>' + c.author + '</span><span>' + c.date + '</span></span>' +
          '</div>';
        }).join("");
      } else {
        commitsSection.style.display = "none";
      }

      // Render diff stat
      var diffStatWrap = document.getElementById("diff-stat-wrap");
      var diffStatContent = document.getElementById("diff-stat-content");
      if (data.diffStat) {
        diffStatWrap.style.display = "";
        diffStatContent.textContent = data.diffStat;
      } else {
        diffStatWrap.style.display = "none";
      }

      var curDirty = isDirty(data.current);
      var upDirty = isDirty(data.upstream);

      if (upDirty) {
        mergeCheckEl.className = "merge-check conflict";
        mergeCheckEl.textContent = "\\u26A0\\uFE0F \\u4E0A\\u6E38\\u6709\\u672A\\u63D0\\u4EA4\\u53D8\\u66F4\\uFF0C\\u8BF7\\u5148\\u53BB\\u4E0A\\u6E38\\u63D0\\u4EA4";
        return;
      }
      if (curDirty) {
        mergeCheckEl.className = "merge-check conflict";
        mergeCheckEl.textContent = "\\u26A0\\uFE0F \\u5F53\\u524D\\u5DE5\\u4F5C\\u533A\\u6709\\u672A\\u63D0\\u4EA4\\u53D8\\u66F4\\uFF0C\\u8BF7\\u5148\\u63D0\\u4EA4";
        return;
      }

      fetch("/merge-check").then(r => r.json()).then(function(mc) {
        if (mc.status === "merged") {
          mergeCheckEl.className = "merge-check clean";
          mergeCheckEl.textContent = "\\u2705 " + mc.message;
          btnMerge.disabled = true;
          btnMerge.innerHTML = "Merged \\u2705";
          deleteWrap.style.display = "";
        } else if (mc.status === "behind") {
          mergeCheckEl.className = "merge-check behind";
          mergeCheckEl.textContent = "\\u26A0\\uFE0F " + mc.message + "\\uFF0C\\u8BF7\\u5148\\u540C\\u6B65\\u4E0A\\u6E38";
          btnMerge.disabled = true;
        } else if (mc.status === "conflict") {
          mergeCheckEl.className = "merge-check conflict";
          mergeCheckEl.textContent = "\\u274C \\u68C0\\u6D4B\\u5230\\u5408\\u5E76\\u51B2\\u7A81\\uFF0C\\u9700\\u8981\\u5148\\u89E3\\u51B3\\u51B2\\u7A81\\u518D\\u5408\\u5E76";
          btnMerge.disabled = true;
        } else if (mc.status === "up_to_date") {
          mergeCheckEl.className = "merge-check clean";
          mergeCheckEl.textContent = "\\u2705 " + mc.message;
          btnMerge.disabled = true;
          btnMerge.textContent = "Already up to date";
          deleteWrap.style.display = "";
        } else if (mc.status === "clean") {
          mergeCheckEl.className = "merge-check clean";
          mergeCheckEl.textContent = "\\u2705 \\u53EF\\u4EE5\\u5408\\u5E76";
          btnMerge.disabled = false;
        } else {
          mergeCheckEl.className = "merge-check";
          mergeCheckEl.textContent = mc.message || "";
          btnMerge.disabled = true;
        }
      });
    }).catch(function() {
      mergeCheckEl.className = "merge-check";
      mergeCheckEl.textContent = "";
    });
  }
  refreshState();

  // --- SSE runner ---
  function appendLine(text, cls) {
    var div = document.createElement("div");
    div.className = cls;
    div.textContent = text;
    termContent.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
  }

  function setStatus(el, state, text) {
    el.className = "status status-" + state;
    el.textContent = text;
  }

  function runSSE(url, onDone) {
    terminal.classList.add("visible");
    return new Promise(function(resolve) {
      fetch(url, { method: "POST" }).then(function(res) {
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = "";
        function read() {
          reader.read().then(function(result) {
            if (result.done) { resolve(); return; }
            buf += decoder.decode(result.value, { stream: true });
            var parts = buf.split("\\n\\n");
            buf = parts.pop();
            for (var i = 0; i < parts.length; i++) {
              var line = parts[i].replace(/^data: /, "");
              if (!line) continue;
              try {
                var msg = JSON.parse(line);
                if (msg.type === "stdout") appendLine(msg.data, "stdout");
                else if (msg.type === "stderr") appendLine(msg.data, "stderr");
                else if (msg.type === "exit") {
                  if (msg.data === 0) {
                    appendLine("\\nProcess exited with code 0", "exit-success");
                    if (onDone) onDone(true);
                  } else {
                    appendLine("\\nProcess exited with code " + msg.data, "exit-fail");
                    if (onDone) onDone(false);
                  }
                }
                else if (msg.type === "error") {
                  appendLine("Error: " + msg.data, "stderr");
                  if (onDone) onDone(false);
                }
              } catch(e) {}
            }
            read();
          });
        }
        read();
      });
    });
  }

  // --- Merge ---
  async function doMerge() {
    btnMerge.disabled = true;
    btnMerge.innerHTML = '<span class="spinner"></span> Merging...';
    setStatus(mergeStatus, "running", "Merging");
    termContent.innerHTML = "";

    var ok = await new Promise(function(resolve) {
      runSSE("/merge", resolve);
    });

    if (ok) {
      setStatus(mergeStatus, "success", "Merged \\u2705");
      btnMerge.innerHTML = "Merged \\u2705";
      deleteWrap.style.display = "";
      refreshState();
    } else {
      setStatus(mergeStatus, "failed", "Failed");
      btnMerge.innerHTML = "Merge failed \\u2014 retry";
      btnMerge.disabled = false;
    }
  }

  // --- Delete ---
  function doDelete() {
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<span class="spinner"></span> Deleting...';
    termContent.innerHTML = "";

    runSSE("/delete", function(success) {
      if (success) {
        btnDelete.innerHTML = "Deleted \\u2705";
        refreshState();
      } else {
        btnDelete.innerHTML = "Delete failed";
        btnDelete.disabled = false;
      }
    });
  }`
      : "";

    // ─ Assemble full HTML ─
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report: ${pageTitle}</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #8b949e;
    --accent: #58a6ff;
    --green: #3fb950;
    --red: #f85149;
    --yellow: #d29922;
    --purple: #bc8cff;
    --cyan: #39d2c0;
    --terminal-bg: #010409;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  .container {
    max-width: 90%;
    margin: 0 auto;
    padding: 24px 16px;
  }

  /* Verdict banner */
  .verdict-banner {
    border-radius: 8px;
    padding: 14px 20px;
    margin-bottom: 20px;
    font-size: 1.05em;
    line-height: 1.5;
  }
  .verdict-banner p { margin: 2px 0; }
  .verdict-banner strong { font-weight: 700; }
  .verdict-pass { background: rgba(63,185,80,0.1); border: 1px solid rgba(63,185,80,0.4); }
  .verdict-warn { background: rgba(210,153,34,0.1); border: 1px solid rgba(210,153,34,0.4); }
  .verdict-fail { background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.4); }

  /* Chain flow indicator */
  .chain-flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 0;
    margin-bottom: 16px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .chain-node {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border-radius: 16px;
    font-weight: 500;
    font-size: 12px;
  }
  .chain-arrow { color: var(--text-muted); font-size: 16px; }
  .chain-node.dimmed { opacity: 0.3; }

  /* Chain node & tab badge colors */
  .chain-node.req,     .tab-badge.req     { background: rgba(88,166,255,0.1);  color: var(--accent); }
  .chain-node.req     { border: 1px solid rgba(88,166,255,0.3); }
  .tab-badge.req      { background: rgba(88,166,255,0.15); }

  .chain-node.impl,    .tab-badge.impl    { background: rgba(210,153,34,0.1);  color: var(--yellow); }
  .chain-node.impl    { border: 1px solid rgba(210,153,34,0.3); }
  .tab-badge.impl     { background: rgba(210,153,34,0.15); }

  .chain-node.accept,  .tab-badge.accept  { background: rgba(63,185,80,0.1);   color: var(--green); }
  .chain-node.accept  { border: 1px solid rgba(63,185,80,0.3); }
  .tab-badge.accept   { background: rgba(63,185,80,0.15); }

  .chain-node.defect,  .tab-badge.defect  { background: rgba(248,81,73,0.1);   color: var(--red); }
  .chain-node.defect  { border: 1px solid rgba(248,81,73,0.3); }
  .tab-badge.defect   { background: rgba(248,81,73,0.15); }

  .chain-node.fix,     .tab-badge.fix     { background: rgba(210,153,34,0.1);  color: var(--yellow); }
  .chain-node.fix     { border: 1px solid rgba(210,153,34,0.3); }
  .tab-badge.fix      { background: rgba(210,153,34,0.15); }

  .chain-node.verify,  .tab-badge.verify  { background: rgba(63,185,80,0.1);   color: var(--green); }
  .chain-node.verify  { border: 1px solid rgba(63,185,80,0.3); }
  .tab-badge.verify   { background: rgba(63,185,80,0.15); }

  .chain-node.guard,   .tab-badge.guard   { background: rgba(57,210,192,0.1);  color: var(--cyan); }
  .chain-node.guard   { border: 1px solid rgba(57,210,192,0.3); }
  .tab-badge.guard    { background: rgba(57,210,192,0.15); }

  .chain-node.report,  .tab-badge.report  { background: rgba(188,140,255,0.1); color: var(--purple); }
  .chain-node.report  { border: 1px solid rgba(188,140,255,0.3); }
  .tab-badge.report   { background: rgba(188,140,255,0.15); }

  .chain-node.integrate, .tab-badge.integrate { background: rgba(210,153,34,0.1);  color: var(--yellow); }
  .chain-node.integrate { border: 1px solid rgba(210,153,34,0.3); }
  .tab-badge.integrate  { background: rgba(210,153,34,0.15); }

  .chain-node.release,   .tab-badge.release   { background: rgba(63,185,80,0.1);   color: var(--green); }
  .chain-node.release   { border: 1px solid rgba(63,185,80,0.3); }
  .tab-badge.release    { background: rgba(63,185,80,0.15); }

  /* Tabs */
  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0;
  }
  .tab-btn {
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .tab-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 600;
  }

  /* Tab content */
  .tab-panel {
    display: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    overflow: hidden;
  }
  .tab-panel.active { display: block; }
  .panel-body {
    padding: 16px 20px;
    max-height: 700px;
    overflow-y: auto;
    font-size: 0.9em;
  }
  .panel-body h1 { font-size: 1.3em; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin: 8px 0; }
  .panel-body h2 { font-size: 1.1em; border-bottom: none; margin: 16px 0 8px; color: var(--accent); }
  .panel-body h3 { font-size: 0.95em; margin: 12px 0 4px; }
  .panel-body p { margin: 4px 0; }
  .panel-body ul, .panel-body ol { padding-left: 20px; margin: 4px 0; }
  .panel-body li { margin: 2px 0; }
  .panel-body code {
    background: rgba(255,255,255,0.06);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.85em;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  .panel-body pre {
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
    overflow-x: auto;
    margin: 6px 0;
  }
  .panel-body pre code { background: none; padding: 0; }
  .panel-body table { border-collapse: collapse; width: 100%; margin: 6px 0; }
  .panel-body th, .panel-body td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; font-size: 0.9em; }
  .panel-body th { background: rgba(255,255,255,0.03); font-weight: 600; }
  .panel-body blockquote { border-left: 3px solid var(--border); padding-left: 10px; color: var(--text-muted); margin: 6px 0; }
  .panel-body a { color: var(--accent); text-decoration: none; }
  .panel-body a:hover { text-decoration: underline; }
  .panel-body img { max-width: 100%; border-radius: 6px; border: 1px solid var(--border); margin: 6px 0; }

  /* Actions area */
  .actions {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin-top: 24px;
  }
  .actions-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .actions-title { font-size: 1.1em; font-weight: 600; }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-merge { background: #238636; border-color: #2ea043; color: #fff; }
  .btn-merge:hover:not(:disabled) { background: #2ea043; }
  .btn-delete { background: #da3633; border-color: #f85149; color: #fff; }
  .btn-delete:hover:not(:disabled) { background: #f85149; }
  .btn-group { display: flex; gap: 12px; align-items: center; }

  /* Terminal */
  .terminal {
    background: var(--terminal-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-top: 12px;
    display: none;
    max-height: 400px;
    overflow-y: auto;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
  }
  .terminal.visible { display: block; }
  .terminal-content { padding: 12px 16px; }
  .terminal .stdout { color: var(--text); }
  .terminal .stderr { color: var(--yellow); }
  .terminal .exit-success { color: var(--green); font-weight: 600; margin-top: 8px; }
  .terminal .exit-fail { color: var(--red); font-weight: 600; margin-top: 8px; }

  /* Status badges */
  .status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .status-success { background: rgba(63,185,80,0.15); color: var(--green); }
  .status-failed { background: rgba(248,81,73,0.15); color: var(--red); }
  .status-running { background: rgba(210,153,34,0.15); color: var(--yellow); }

  /* Merge check */
  .merge-check {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .merge-check.checking { color: var(--text-muted); }
  .merge-check.clean { background: rgba(63,185,80,0.1); color: var(--green); }
  .merge-check.conflict { background: rgba(248,81,73,0.1); color: var(--red); }
  .merge-check.behind { background: rgba(210,153,34,0.1); color: var(--yellow); }

  /* Worktree status cards */
  .wt-status { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .wt-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
  }
  .wt-card-header {
    display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    font-weight: 600; font-size: 12px; text-transform: uppercase;
    letter-spacing: 0.5px; color: var(--text-muted);
  }
  .wt-card-branch {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 13px; font-weight: 600; color: var(--text);
  }
  .wt-card-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; font-size: 12px; }
  .wt-badge {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 500;
  }
  .wt-badge.clean { background: rgba(63,185,80,0.12); color: var(--green); }
  .wt-badge.staged { background: rgba(88,166,255,0.12); color: var(--accent); }
  .wt-badge.dirty { background: rgba(210,153,34,0.12); color: var(--yellow); }
  .wt-badge.untracked { background: rgba(139,148,158,0.12); color: var(--text-muted); }
  .wt-badge.ahead { background: rgba(63,185,80,0.12); color: var(--green); }
  .wt-badge.behind { background: rgba(248,81,73,0.12); color: var(--red); }

  /* Commits */
  .commits-header {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 8px; margin-top: 4px;
  }
  .commits-title {
    font-size: 13px; font-weight: 600; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .commits-count {
    font-size: 11px; padding: 1px 7px; border-radius: 10px;
    background: rgba(88,166,255,0.12); color: var(--accent); font-weight: 500;
  }
  .commits-list {
    border: 1px solid var(--border); border-radius: 6px;
    overflow: hidden; margin-bottom: 10px;
  }
  .commit-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; font-size: 13px;
    border-bottom: 1px solid var(--border);
  }
  .commit-row:last-child { border-bottom: none; }
  .commit-hash {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 12px; color: var(--accent); font-weight: 500;
    background: rgba(88,166,255,0.08); padding: 1px 6px;
    border-radius: 4px; white-space: nowrap;
  }
  .commit-subject { flex: 1; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .commit-meta {
    font-size: 11px; color: var(--text-muted); white-space: nowrap;
    display: flex; align-items: center; gap: 6px;
  }
  .diff-stat-details { margin-bottom: 10px; }
  .diff-stat-summary {
    font-size: 12px; color: var(--text-muted); cursor: pointer;
    padding: 4px 0; user-select: none;
  }
  .diff-stat-summary:hover { color: var(--text); }
  .diff-stat-content {
    background: rgba(0,0,0,0.3); border: 1px solid var(--border);
    border-radius: 6px; padding: 8px 12px; margin-top: 4px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 12px; color: var(--text-muted); overflow-x: auto;
    line-height: 1.5;
  }

  /* Spinner */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid transparent; border-top-color: currentColor;
    border-radius: 50%; animation: spin 0.6s linear infinite;
  }
</style>
</head>
<body>
<div class="container">
  <!-- Chain flow indicator -->
  <div class="chain-flow">
    ${chainHtml}
  </div>

  <!-- Verdict banner -->
  <div id="verdict-mount"></div>

  <!-- Tab bar -->
  <div class="tab-bar">
    ${tabBarHtml}
  </div>

  <!-- Tab panels -->
  ${panelsHtml}
  ${actionsHtml}
</div>

<script>
  // --- Render markdown ---
  var reports = ${JSON.stringify(data)};
  var VERDICT_SOURCE = ${JSON.stringify(config.verdictSource)};
  var FAIL_KW = ${JSON.stringify(VERDICT_FAIL_KW)};
  var WARN_KW = ${JSON.stringify(VERDICT_WARN_KW)};

  // Rewrite image paths to /assets/ route
  function rewriteImagePaths(html) {
    return html.replace(/src="([^"]*\\.assets\\/[^"]*)"/g, 'src="/assets/$1"');
  }

  // Render all reports
  for (var key in reports) {
    if (reports[key]) {
      var el = document.getElementById("content-" + key);
      if (el) el.innerHTML = rewriteImagePaths(marked.parse(reports[key]));
    }
  }

  // Extract verdict from source tab
  var srcContainer = document.getElementById("content-" + VERDICT_SOURCE);
  if (srcContainer) {
    var h2s = srcContainer.querySelectorAll("h2");
    for (var i = 0; i < h2s.length; i++) {
      var h2 = h2s[i];
      var txt = h2.textContent.trim();
      if (txt.includes("Verdict") || txt.includes("\\u88C1\\u5B9A")) {
        var nodes = [];
        var sib = h2.nextElementSibling;
        while (sib && sib.tagName !== "H2") {
          nodes.push(sib);
          sib = sib.nextElementSibling;
        }
        var verdictText = nodes.map(function(n) { return n.textContent; }).join(" ");
        var verdictHtml = nodes.map(function(n) { return n.outerHTML; }).join("");

        var banner = document.createElement("div");
        banner.innerHTML = verdictHtml;

        if (FAIL_KW.some(function(k) { return verdictText.includes(k); })) {
          banner.className = "verdict-banner verdict-fail";
        } else if (WARN_KW.some(function(k) { return verdictText.includes(k); })) {
          banner.className = "verdict-banner verdict-warn";
        } else {
          banner.className = "verdict-banner verdict-pass";
        }

        document.getElementById("verdict-mount").appendChild(banner);
        break;
      }
    }
  }

  // --- Tab switching ---
  function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.toggle("active", b.dataset.tab === name); });
    document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.toggle("active", p.id === "panel-" + name); });
  }

  // --- SSE auto-refresh on file changes ---
  (function() {
    var evtSource = new EventSource("/events");
    evtSource.onmessage = function() {
      location.reload();
    };
    evtSource.onerror = function() {
      // Reconnect handled automatically by EventSource
    };
  })();

  ${actionsJs}
<\/script>
</body>
</html>`;
  }

  /* ── HTTP Server ────────────────────────────────────────────── */

  const server = createServer((req, res) => {
    // GET / → HTML page
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildHtml());
      return;
    }

    // GET /ping → liveness check
    if (req.method === "GET" && req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, pid: process.pid }));
      return;
    }

    // GET /events → SSE stream for file-change notifications
    if (req.method === "GET" && req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      sseClients.add(res);
      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    // GET /assets/* → serve images from .worktree/
    if (req.method === "GET" && req.url.startsWith("/assets/")) {
      const relPath = decodeURIComponent(req.url.slice("/assets/".length));
      const filePath = join(WT_DIR, relPath);

      // Security: prevent path traversal
      if (!filePath.startsWith(WT_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end("File not found");
        return;
      }

      const MIME_TYPES = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      };
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const stat = statSync(filePath);

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stat.size,
      });
      createReadStream(filePath).pipe(res);
      return;
    }

    // ── Actions routes (only when enabled) ─────────────────────
    if (showActions) {
      if (req.method === "GET" && req.url === "/status") {
        res.writeHead(200, { "Content-Type": "application/json" });

        function parseGitStatus(cwd) {
          const raw = execSync("git status --short", {
            cwd,
            encoding: "utf-8",
          }).trim();
          if (!raw) return { staged: 0, unstaged: 0, untracked: 0 };
          let staged = 0,
            unstaged = 0,
            untracked = 0;
          for (const line of raw.split("\n")) {
            if (!line) continue;
            const x = line[0];
            const y = line[1];
            if (x === "?" && y === "?") {
              untracked++;
              continue;
            }
            if (x !== " " && x !== "?") staged++;
            if (y !== " " && y !== "?") unstaged++;
          }
          return { staged, unstaged, untracked };
        }

        const result = { current: {}, upstream: {} };
        try {
          const curStatus = parseGitStatus(CWD);
          const ahead = execSync(
            `git rev-list ${baseBranch}..HEAD --count`,
            { cwd: CWD, encoding: "utf-8" }
          ).trim();
          const behind = execSync(
            `git rev-list HEAD..${baseBranch} --count`,
            { cwd: CWD, encoding: "utf-8" }
          ).trim();
          result.current = {
            branch: currentBranch,
            ...curStatus,
            ahead: parseInt(ahead),
            behind: parseInt(behind),
          };

          const upStatus = parseGitStatus(upstreamPath);
          result.upstream = {
            branch: baseBranch,
            path: upstreamPath,
            ...upStatus,
          };

          // Upstream ahead/behind relative to its remote tracking branch
          try {
            const upRemote = execSync(
              `git rev-parse --abbrev-ref ${baseBranch}@{upstream}`,
              { cwd: upstreamPath, encoding: "utf-8" }
            ).trim();
            const upAhead = execSync(
              `git rev-list ${upRemote}..${baseBranch} --count`,
              { cwd: upstreamPath, encoding: "utf-8" }
            ).trim();
            const upBehind = execSync(
              `git rev-list ${baseBranch}..${upRemote} --count`,
              { cwd: upstreamPath, encoding: "utf-8" }
            ).trim();
            result.upstream.ahead = parseInt(upAhead);
            result.upstream.behind = parseInt(upBehind);
          } catch {}

          // Commits between baseBranch and HEAD
          try {
            const logRaw = execSync(
              `git log ${baseBranch}..HEAD --pretty=format:"%h|%s|%an|%ar" --no-merges`,
              { cwd: CWD, encoding: "utf-8" }
            ).trim();
            result.commits = logRaw
              ? logRaw.split("\n").map((line) => {
                  const [hash, subject, author, date] = line.split("|");
                  return { hash, subject, author, date };
                })
              : [];
          } catch {
            result.commits = [];
          }

          // Changed files between baseBranch and HEAD
          try {
            const diffRaw = execSync(
              `git diff ${baseBranch}..HEAD --stat --stat-width=60`,
              { cwd: CWD, encoding: "utf-8" }
            ).trim();
            result.diffStat = diffRaw || "";
          } catch {
            result.diffStat = "";
          }
        } catch (e) {
          result.error = e.message;
        }
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === "GET" && req.url === "/merge-check") {
        res.writeHead(200, { "Content-Type": "application/json" });
        // After successful merge, squash creates divergence — skip re-check
        if (mergeState === "success") {
          res.end(
            JSON.stringify({ status: "merged", message: "\u5DF2\u5408\u5E76" })
          );
          return;
        }
        if (!baseBranch || !currentBranch) {
          res.end(
            JSON.stringify({
              status: "unknown",
              message: "Cannot determine branches",
            })
          );
          return;
        }
        try {
          const behind = execSync(
            `git rev-list HEAD..${baseBranch} --count`,
            { cwd: CWD, encoding: "utf-8" }
          ).trim();
          if (behind !== "0") {
            res.end(
              JSON.stringify({
                status: "behind",
                behind: parseInt(behind),
                message: `\u843D\u540E\u4E0A\u6E38 ${behind} \u4E2A commit`,
              })
            );
            return;
          }
          // Check if there's actually anything to merge
          const diffCheck = execSync(
            `git diff ${baseBranch}..HEAD --quiet 2>/dev/null; echo $?`,
            { cwd: CWD, encoding: "utf-8", shell: true }
          ).trim();
          if (diffCheck === "0") {
            res.end(
              JSON.stringify({
                status: "up_to_date",
                message: "\u5DF2\u7ECF\u662F\u6700\u65B0\uFF0C\u65E0\u9700\u5408\u5E76",
              })
            );
            return;
          }
          try {
            execSync(
              `git merge-tree --write-tree ${baseBranch} ${currentBranch}`,
              { cwd: CWD, encoding: "utf-8" }
            );
            res.end(
              JSON.stringify({
                status: "clean",
                message: "\u65E0\u51B2\u7A81\uFF0C\u53EF\u4EE5\u5408\u5E76",
              })
            );
          } catch {
            res.end(
              JSON.stringify({
                status: "conflict",
                message: "\u68C0\u6D4B\u5230\u5408\u5E76\u51B2\u7A81",
              })
            );
          }
        } catch (e) {
          res.end(JSON.stringify({ status: "unknown", message: e.message }));
        }
        return;
      }

      if (req.method === "POST" && req.url === "/merge") {
        if (mergeState === "running") {
          res.writeHead(409);
          res.end("Merge already running");
          return;
        }
        if (mergeState === "success") {
          res.writeHead(409);
          res.end("Already merged");
          return;
        }
        // Server-side behind guard
        try {
          const behind = execSync(
            `git rev-list HEAD..${baseBranch} --count`,
            { cwd: CWD, encoding: "utf-8" }
          ).trim();
          if (behind !== "0") {
            res.writeHead(409);
            res.end(
              `Cannot merge: behind upstream by ${behind} commit(s). Sync first.`
            );
            return;
          }
        } catch {}

        // Use worktree.sh for merge
        const scriptPath = join(mainRepo, "scripts", "worktree.sh");
        if (!existsSync(scriptPath) || !wtName) {
          res.writeHead(400);
          res.end("Cannot determine merge parameters");
          return;
        }
        mergeState = "running";
        const child = sseExec(scriptPath, ["merge", wtName], { cwd: mainRepo }, res);
        child.on("close", (code) => {
          mergeState = code === 0 ? "success" : "failed";
        });
        return;
      }

      if (req.method === "POST" && req.url === "/delete") {
        if (deleteState === "running") {
          res.writeHead(409);
          res.end("Delete already running");
          return;
        }
        if (!wtName) {
          res.writeHead(400);
          res.end("Not in a worktree");
          return;
        }
        deleteState = "running";
        const scriptPath = join(mainRepo, "scripts", "worktree.sh");
        const child = sseExec(
          scriptPath,
          ["delete", wtName],
          { cwd: mainRepo },
          res
        );
        child.on("close", (code) => {
          deleteState = code === 0 ? "success" : "failed";
        });
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });

  /* ── Start server ───────────────────────────────────────────── */

  server.listen(0, () => {
    const port = server.address().port;
    const url = `http://localhost:${port}`;

    // Write PID/port for idempotent detection
    try {
      writeFileSync(
        VIEWER_JSON,
        JSON.stringify({ pid: process.pid, port, url }, null, 2)
      );
    } catch {}

    console.log(`Report Viewer: ${url}`);
    console.log(`Branch: ${currentBranch}${baseBranch ? " \u2192 " + baseBranch : ""}`);
    console.log("Press Ctrl+C to stop.\n");

    try {
      execSync(`open "${url}"`);
    } catch {
      console.log(`Open ${url} in your browser.`);
    }
  });

  // Clean up .viewer.json on exit
  function cleanup() {
    try {
      unlinkSync(VIEWER_JSON);
    } catch {}
    process.exit(0);
  }
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
