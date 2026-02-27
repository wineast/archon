#!/usr/bin/env node
/**
 * PR Report Web Viewer
 * 独立 Node.js 脚本，零外部依赖。
 * 读取 .worktree/REPORT.md + merge.sh，提供 Web 界面查看报告、一键合并、删除工作区。
 *
 * Usage: node .claude/skills/pr-wt/serve-report.mjs
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { join, extname } from "node:path";
import { spawn, execSync } from "node:child_process";

const CWD = process.cwd();
const WORKTREE_DIR = join(CWD, ".worktree");

// --- Read files ---

const REPORT_PATH = join(WORKTREE_DIR, "REPORT.md");
const MERGE_SH_PATH = join(WORKTREE_DIR, "merge.sh");
const REQ_PATH = join(WORKTREE_DIR, "REQ.md");

function readReport() {
  return readFileSync(REPORT_PATH, "utf-8");
}

function readReq() {
  try {
    return readFileSync(REQ_PATH, "utf-8");
  } catch {
    return null;
  }
}

let mergeShContent;
try {
  readReport(); // validate existence at startup
} catch {
  console.error("Error: .worktree/REPORT.md not found. Run /pr-wt first.");
  process.exit(1);
}
try {
  mergeShContent = readFileSync(MERGE_SH_PATH, "utf-8");
} catch {
  console.error("Error: .worktree/merge.sh not found. Run /pr-wt first.");
  process.exit(1);
}

// --- Parse merge.sh for MAIN_REPO and WT_NAME ---

const mainRepoMatch = mergeShContent.match(/^MAIN_REPO="(.+)"$/m);
const wtNameMatch = mergeShContent.match(/^WT_NAME="(.+)"$/m);

if (!mainRepoMatch || !wtNameMatch) {
  console.error("Error: Could not parse MAIN_REPO/WT_NAME from merge.sh");
  process.exit(1);
}

const MAIN_REPO = mainRepoMatch[1];
const WT_NAME = wtNameMatch[1];

// --- Read meta.json for baseBranch + wt branch ---

let baseBranch, wtBranch;
try {
  const meta = JSON.parse(readFileSync(join(WORKTREE_DIR, "meta.json"), "utf-8"));
  baseBranch = meta.baseBranch;
  wtBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: CWD, encoding: "utf-8" }).trim();
} catch {
  // fallback: will skip merge-check
}

// --- Find upstream worktree path (the one that has baseBranch checked out) ---

let upstreamPath = MAIN_REPO; // fallback
if (baseBranch) {
  try {
    const wtListRaw = execSync("git worktree list --porcelain", { cwd: CWD, encoding: "utf-8" });
    const entries = wtListRaw.split("\n\n").filter(Boolean);
    for (const entry of entries) {
      const lines = entry.split("\n");
      const pathLine = lines.find(l => l.startsWith("worktree "));
      const branchLine = lines.find(l => l.startsWith("branch "));
      if (pathLine && branchLine) {
        const branchRef = branchLine.replace("branch ", "");
        const shortBranch = branchRef.replace("refs/heads/", "");
        if (shortBranch === baseBranch) {
          upstreamPath = pathLine.replace("worktree ", "");
          break;
        }
      }
    }
  } catch {}
}

// Test results: check worktree first, fallback to main repo
const WT_TEST_RESULTS = join(CWD, "web", "test-results");
const MAIN_TEST_RESULTS = join(MAIN_REPO, "web", "test-results");
const TEST_RESULTS_DIR = existsSync(WT_TEST_RESULTS) ? WT_TEST_RESULTS : MAIN_TEST_RESULTS;

// --- State ---

let mergeState = "idle"; // idle | running | success | failed
let deleteState = "idle";

// --- SSE helper ---

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

// --- HTML template ---

function buildHtml() {
  // Re-read on every request so edits are visible after refresh
  const escapedMd = JSON.stringify(readReport());
  const reqMd = readReq();
  const escapedReqMd = reqMd ? JSON.stringify(reqMd) : "null";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PR Report: ${WT_NAME}</title>
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
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px;
  }
  .container.wide { max-width: 1400px; }

  /* Main two-column layout: REQ (left) | Report (right) */
  .main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }
  .main-grid.single { grid-template-columns: 1fr; }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .panel.left { border-color: #3d5a80; }
  .panel.right { border-color: #30363d; }
  .panel-header {
    padding: 10px 16px;
    font-size: 0.9em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--border);
  }
  .panel.left .panel-header { color: var(--accent); border-bottom-color: #3d5a80; }
  .panel-badge {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .panel.left .panel-badge { background: rgba(88, 166, 255, 0.15); color: var(--accent); }
  .panel.right .panel-badge { background: rgba(255,255,255,0.08); color: var(--text-muted); }
  .panel-body {
    padding: 12px 16px;
    max-height: 700px;
    overflow-y: auto;
    font-size: 0.9em;
  }
  .panel-body h1 { font-size: 1.2em; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin: 8px 0; }
  .panel-body h2 { font-size: 1em; border-bottom: none; margin: 12px 0 6px; color: var(--text-muted); }
  .panel-body h3 { font-size: 0.9em; margin: 10px 0 4px; }
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
  .panel-body video { width: 100%; max-width: 560px; border-radius: 6px; border: 1px solid var(--border); margin: 6px 0; }

  /* Acceptance Reviews — comment thread */
  .reviews-section { margin-bottom: 24px; }
  .reviews-title {
    font-size: 1.1em;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .review-comment {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  .review-comment-header {
    padding: 8px 16px;
    background: rgba(255,255,255,0.02);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9em;
  }
  .review-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #58a6ff, #3fb950);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }
  .review-name { font-weight: 600; }
  .review-verdict-badge {
    margin-left: auto;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 500;
  }
  .review-verdict-badge.pass { background: rgba(63, 185, 80, 0.15); color: var(--green); }
  .review-verdict-badge.fail { background: rgba(248, 81, 73, 0.15); color: var(--red); }
  .review-comment-body {
    padding: 12px 16px;
    font-size: 0.9em;
    line-height: 1.6;
  }
  .review-comment-body h4 { font-size: 0.85em; color: var(--text-muted); margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .review-comment-body h4:first-child { margin-top: 0; }
  .review-comment-body ul { padding-left: 18px; margin: 4px 0; }
  .review-comment-body li { margin: 2px 0; }
  .review-comment-body code { background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; font-size: 0.85em; font-family: "SFMono-Regular", Consolas, monospace; }
  .reviews-consensus {
    padding: 10px 16px;
    background: rgba(63, 185, 80, 0.05);
    border: 1px solid rgba(63, 185, 80, 0.2);
    border-radius: 8px;
    font-size: 0.9em;
    font-weight: 500;
  }

  /* Legacy .report styles removed — now using .panel-body */

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
  .actions-title {
    font-size: 1.1em;
    font-weight: 600;
  }

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
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-merge {
    background: #238636;
    border-color: #2ea043;
    color: #fff;
  }
  .btn-merge:hover:not(:disabled) {
    background: #2ea043;
  }
  .btn-delete {
    background: #da3633;
    border-color: #f85149;
    color: #fff;
  }
  .btn-delete:hover:not(:disabled) {
    background: #f85149;
  }
  .btn-sync {
    background: transparent;
    border-color: var(--yellow);
    color: var(--yellow);
  }
  .btn-sync:hover:not(:disabled) {
    background: rgba(210, 153, 34, 0.1);
  }

  .btn-group {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .btn-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .btn-desc {
    font-size: 11px;
    color: var(--text-muted);
    padding-left: 2px;
  }

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

  /* Status badge */
  .status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .status-success { background: rgba(63, 185, 80, 0.15); color: var(--green); }
  .status-failed { background: rgba(248, 81, 73, 0.15); color: var(--red); }
  .status-running { background: rgba(210, 153, 34, 0.15); color: var(--yellow); }

  /* Merge check banner */
  .merge-check {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .merge-check.checking { color: var(--muted); }
  .merge-check.clean { background: rgba(63, 185, 80, 0.1); color: var(--green); }
  .merge-check.conflict { background: rgba(248, 81, 73, 0.1); color: var(--red); }
  .merge-check.behind { background: rgba(210, 153, 34, 0.1); color: var(--yellow); }

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
  .verdict-pass {
    background: rgba(63, 185, 80, 0.1);
    border: 1px solid rgba(63, 185, 80, 0.4);
  }
  .verdict-warn {
    background: rgba(210, 153, 34, 0.1);
    border: 1px solid rgba(210, 153, 34, 0.4);
  }
  .verdict-fail {
    background: rgba(248, 81, 73, 0.1);
    border: 1px solid rgba(248, 81, 73, 0.4);
  }

  /* Video player */
  .video-item { margin: 8px 0; }
  .video-label { font-size: 13px; color: var(--text-muted); margin-bottom: 4px; }

  /* Worktree status cards */
  .wt-status {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }
  .wt-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
  }
  .wt-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }
  .wt-card-branch {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }
  .wt-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
    font-size: 12px;
  }
  .wt-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }
  .wt-badge.clean { background: rgba(63,185,80,0.12); color: var(--green); }
  .wt-badge.staged { background: rgba(88,166,255,0.12); color: var(--accent); }
  .wt-badge.dirty { background: rgba(210,153,34,0.12); color: var(--yellow); }
  .wt-badge.untracked { background: rgba(139,148,158,0.12); color: var(--text-muted); }
  .wt-badge.ahead { background: rgba(63,185,80,0.12); color: var(--green); }
  .wt-badge.behind { background: rgba(248,81,73,0.12); color: var(--red); }

  /* Spinner */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
</style>
</head>
<body>
<div class="container wide" id="main-container">
  <div id="verdict-mount"></div>
  <div class="main-grid" id="main-grid">
    <div class="panel left" id="req-panel" style="display:none">
      <div class="panel-header"><span class="panel-badge">REQ</span> Requirements</div>
      <div class="panel-body" id="req-content"></div>
    </div>
    <div class="panel right" id="report-panel">
      <div class="panel-header"><span class="panel-badge">REPORT</span> Changes</div>
      <div class="panel-body" id="report"></div>
    </div>
  </div>
  <div class="reviews-section" id="reviews-section" style="display:none"></div>

  <div class="actions">
    <div class="actions-header">
      <span class="actions-title">Actions</span>
      <span id="merge-status"></span>
      <span id="delete-status"></span>
    </div>
    <div class="wt-status" id="wt-status">
      <div class="wt-card" id="wt-upstream">
        <div class="wt-card-header">&#x2191; Upstream</div>
        <div class="wt-card-branch" id="wt-upstream-branch">...</div>
        <div class="wt-card-meta" id="wt-upstream-meta"></div>
      </div>
      <div class="wt-card" id="wt-current">
        <div class="wt-card-header">&#x25CF; Current</div>
        <div class="wt-card-branch" id="wt-current-branch">...</div>
        <div class="wt-card-meta" id="wt-current-meta"></div>
      </div>
    </div>
    <div class="merge-check checking" id="merge-check">Checking merge status...</div>
    <div class="btn-group">
      <div class="btn-item" id="btn-sync-wrap" style="display:none">
        <button class="btn btn-sync" id="btn-sync" onclick="doSync()">Sync Upstream</button>
        <span class="btn-desc">临时 commit → git rebase → 恢复未提交状态</span>
      </div>
      <div class="btn-item" id="btn-merge-wrap">
        <button class="btn btn-merge" id="btn-merge" onclick="doMerge()">Merge to upstream</button>
        <span class="btn-desc">typecheck + test → wt-merge 合并到上游</span>
      </div>
      <div class="btn-item" id="btn-delete-wrap" style="display:none">
        <button class="btn btn-delete" id="btn-delete" onclick="doDelete()">Delete worktree</button>
        <span class="btn-desc">删除工作区分支和目录</span>
      </div>
    </div>
    <div class="terminal" id="terminal">
      <div class="terminal-content" id="terminal-content"></div>
    </div>
  </div>
</div>

<script>
  // --- Render markdown into a temp container for extraction ---
  const md = ${escapedMd};
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = marked.parse(md);

  // Helper: extract a section by h2 title, returns { heading, nodes }
  function extractSection(container, title) {
    const h2s = container.querySelectorAll("h2");
    for (const h2 of h2s) {
      if (h2.textContent.trim() === title) {
        const nodes = [];
        let sib = h2.nextElementSibling;
        while (sib && sib.tagName !== "H2") {
          nodes.push(sib);
          sib = sib.nextElementSibling;
        }
        const html = nodes.map(n => n.outerHTML).join("");
        nodes.forEach(n => n.remove());
        h2.remove();
        return html;
      }
    }
    return null;
  }

  // 1. Extract Verdict → top banner
  const verdictHtml = extractSection(tempDiv, "Verdict");
  if (verdictHtml) {
    const banner = document.createElement("div");
    banner.innerHTML = verdictHtml;
    const text = banner.textContent;
    if (text.includes("不建议合并") || text.includes("❌")) {
      banner.className = "verdict-banner verdict-fail";
    } else if (text.includes("有条件合并") || text.includes("⚠️")) {
      banner.className = "verdict-banner verdict-warn";
    } else {
      banner.className = "verdict-banner verdict-pass";
    }
    document.getElementById("verdict-mount").appendChild(banner);
  }

  // 2. Extract Acceptance Reviews → bottom comment thread
  const reviewsHtml = extractSection(tempDiv, "Acceptance Reviews");

  // 3. Remove the h1 title (redundant with page title)
  const h1 = tempDiv.querySelector("h1");
  if (h1) h1.remove();

  // 4. Remaining content → report panel (right side)
  const reportEl = document.getElementById("report");
  reportEl.innerHTML = tempDiv.innerHTML;

  // 5. Left panel: REQ.md
  const reqMd = ${escapedReqMd};
  const mainGrid = document.getElementById("main-grid");
  if (reqMd) {
    document.getElementById("req-panel").style.display = "";
    document.getElementById("req-content").innerHTML = marked.parse(reqMd);
  } else {
    mainGrid.classList.add("single");
  }

  // 6. Build Acceptance Reviews as comment cards
  if (reviewsHtml) {
    const reviewsSection = document.getElementById("reviews-section");
    reviewsSection.style.display = "";

    // Parse reviewsHtml to extract individual evaluators
    const reviewTemp = document.createElement("div");
    reviewTemp.innerHTML = reviewsHtml;

    let commentsHtml = '<div class="reviews-title">Acceptance Reviews</div>';
    const h3s = reviewTemp.querySelectorAll("h3");
    let consensusHtml = "";

    h3s.forEach((h3, i) => {
      const name = h3.textContent.trim();
      const nodes = [];
      let sib = h3.nextElementSibling;
      while (sib && sib.tagName !== "H3") {
        // Check for consensus line (bold paragraph at end)
        if (sib.tagName === "P" && sib.querySelector("strong") && sib.textContent.includes("共识判定")) {
          consensusHtml = sib.outerHTML;
          sib = sib.nextElementSibling;
          continue;
        }
        nodes.push(sib);
        sib = sib.nextElementSibling;
      }

      const bodyHtml = nodes.map(n => n.outerHTML).join("");
      // Detect verdict from content
      const bodyText = nodes.map(n => n.textContent).join("");
      const isPass = bodyText.includes("✅");
      const verdictLabel = isPass ? "✅ Approved" : "❌ Rejected";
      const verdictClass = isPass ? "pass" : "fail";
      const avatarNum = i + 1;

      commentsHtml += \`
        <div class="review-comment">
          <div class="review-comment-header">
            <div class="review-avatar">\${avatarNum}</div>
            <span class="review-name">\${name}</span>
            <span class="review-verdict-badge \${verdictClass}">\${verdictLabel}</span>
          </div>
          <div class="review-comment-body">\${bodyHtml}</div>
        </div>
      \`;
    });

    if (consensusHtml) {
      commentsHtml += '<div class="reviews-consensus">' + consensusHtml + '</div>';
    }

    reviewsSection.innerHTML = commentsHtml;
  }

  // 7. Post-process: convert video links to inline <video> players
  document.querySelectorAll("#report a[href], #req-content a[href]").forEach(a => {
    const href = a.getAttribute("href");
    if (href && /\\.(webm|mp4)$/i.test(href)) {
      const container = document.createElement("div");
      container.className = "video-item";
      const label = document.createElement("div");
      label.className = "video-label";
      label.textContent = a.textContent;
      const video = document.createElement("video");
      video.src = href;
      video.controls = true;
      video.preload = "metadata";
      container.appendChild(label);
      container.appendChild(video);
      a.parentNode.replaceChild(container, a);
    }
  });

  // --- DOM refs ---
  const mergeCheckEl = document.getElementById("merge-check");
  const terminal = document.getElementById("terminal");
  const termContent = document.getElementById("terminal-content");
  const btnSync = document.getElementById("btn-sync");
  const btnMerge = document.getElementById("btn-merge");
  const btnDelete = document.getElementById("btn-delete");
  const syncWrap = document.getElementById("btn-sync-wrap");
  const mergeWrap = document.getElementById("btn-merge-wrap");
  const deleteWrap = document.getElementById("btn-delete-wrap");
  const mergeStatus = document.getElementById("merge-status");
  const deleteStatus = document.getElementById("delete-status");

  // --- Worktree status ---
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
  function fetchStatus() {
    fetch("/status").then(r => r.json()).then(data => {
      if (data.upstream) {
        document.getElementById("wt-upstream-branch").textContent = data.upstream.branch || "?";
        document.getElementById("wt-upstream-meta").innerHTML = statusBadges(data.upstream);
      }
      if (data.current) {
        document.getElementById("wt-current-branch").textContent = data.current.branch || "?";
        document.getElementById("wt-current-meta").innerHTML = statusBadges(data.current);
      }
    }).catch(() => {});
  }
  fetchStatus();

  function appendLine(text, cls) {
    const div = document.createElement("div");
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

    return new Promise((resolve) => {
      fetch(url, { method: "POST" }).then((res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) { resolve(); return; }
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split("\\n\\n");
            buf = parts.pop();
            for (const part of parts) {
              const line = part.replace(/^data: /, "");
              if (!line) continue;
              try {
                const msg = JSON.parse(line);
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
              } catch {}
            }
            read();
          });
        }
        read();
      });
    });
  }

  // --- Merge pre-check on page load ---
  function checkMergeStatus() {
    mergeCheckEl.className = "merge-check checking";
    mergeCheckEl.textContent = "Checking merge status...";
    syncWrap.style.display = "none";
    mergeWrap.style.display = "none";

    fetch("/merge-check").then(r => r.json()).then(data => {
      mergeCheckEl.className = "merge-check " + data.status;
      mergeCheckEl.textContent = data.message;
      if (data.status === "conflict" || data.status === "behind") {
        syncWrap.style.display = "";
        mergeWrap.style.display = "none";
      } else {
        syncWrap.style.display = "none";
        mergeWrap.style.display = "";
      }
    }).catch(() => {
      mergeCheckEl.className = "merge-check";
      mergeCheckEl.textContent = "";
      mergeWrap.style.display = "";
    });
  }
  checkMergeStatus();

  // --- Sync upstream ---
  async function doSync() {
    btnSync.disabled = true;
    btnSync.innerHTML = '<span class="spinner"></span> Syncing...';
    termContent.innerHTML = "";

    const ok = await new Promise(resolve => {
      runSSE("/sync-upstream", resolve);
    });

    if (ok) {
      syncWrap.style.display = "none";
      fetchStatus();
      checkMergeStatus();
    } else {
      btnSync.innerHTML = "Sync failed";
      btnSync.disabled = false;
      btnSync.onclick = doSync;
    }
  }

  // --- Merge pipeline: checks → merge ---
  async function doMerge() {
    btnMerge.disabled = true;
    termContent.innerHTML = "";

    // Step 1: Quality checks
    btnMerge.innerHTML = '<span class="spinner"></span> Running checks...';
    setStatus(mergeStatus, "running", "Checking");
    appendLine("--- typecheck + test ---", "stdout");

    const checksOk = await new Promise(resolve => {
      runSSE("/run-checks", resolve);
    });

    if (!checksOk) {
      setStatus(mergeStatus, "failed", "Checks failed");
      btnMerge.innerHTML = "Checks failed — retry";
      btnMerge.disabled = false;
      btnMerge.onclick = doMerge;
      return;
    }

    // Step 2: Merge
    btnMerge.innerHTML = '<span class="spinner"></span> Merging...';
    setStatus(mergeStatus, "running", "Merging");
    appendLine("\\n--- merge ---", "stdout");

    const mergeOk = await new Promise(resolve => {
      runSSE("/merge", resolve);
    });

    if (mergeOk) {
      setStatus(mergeStatus, "success", "Merged");
      btnMerge.innerHTML = "Merged";
      deleteWrap.style.display = "";
      fetchStatus();
    } else {
      setStatus(mergeStatus, "failed", "Merge failed");
      btnMerge.innerHTML = "Merge failed — retry";
      btnMerge.disabled = false;
      btnMerge.onclick = doMerge;
    }
  }

  // --- Delete worktree ---
  function doDelete() {
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<span class="spinner"></span> Deleting...';
    setStatus(deleteStatus, "running", "Running");
    appendLine("\\n--- Delete worktree ---", "stdout");

    runSSE("/delete", (success) => {
      if (success) {
        setStatus(deleteStatus, "success", "Deleted");
        btnDelete.innerHTML = "Deleted";
      } else {
        setStatus(deleteStatus, "failed", "Failed");
        btnDelete.innerHTML = "Delete failed";
        btnDelete.disabled = false;
      }
    });
  }
<\/script>
</body>
</html>`;
}

// --- HTTP Server ---

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(buildHtml());
    return;
  }

  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });

    function parseGitStatus(cwd) {
      const raw = execSync("git status --short", { cwd, encoding: "utf-8" }).trim();
      if (!raw) return { staged: 0, unstaged: 0, untracked: 0 };
      let staged = 0, unstaged = 0, untracked = 0;
      for (const line of raw.split("\n")) {
        if (!line) continue;
        const x = line[0]; // staging area
        const y = line[1]; // working tree
        if (x === "?" && y === "?") { untracked++; continue; }
        if (x !== " " && x !== "?") staged++;
        if (y !== " " && y !== "?") unstaged++;
      }
      return { staged, unstaged, untracked };
    }

    const result = { current: {}, upstream: {} };
    try {
      const curStatus = parseGitStatus(CWD);
      const ahead = execSync(`git rev-list ${baseBranch}..HEAD --count`, { cwd: CWD, encoding: "utf-8" }).trim();
      const behind = execSync(`git rev-list HEAD..${baseBranch} --count`, { cwd: CWD, encoding: "utf-8" }).trim();
      result.current = {
        branch: wtBranch,
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
    } catch (e) {
      result.error = e.message;
    }
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "GET" && req.url === "/merge-check") {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (!baseBranch || !wtBranch) {
      res.end(JSON.stringify({ status: "unknown", message: "Cannot determine branches" }));
      return;
    }
    try {
      // Check how many commits the worktree is behind the base branch
      const behind = execSync(`git rev-list HEAD..${baseBranch} --count`, { cwd: CWD, encoding: "utf-8" }).trim();
      if (behind !== "0") {
        res.end(JSON.stringify({ status: "behind", behind: parseInt(behind), message: `落后上游 ${behind} 个 commit` }));
        return;
      }
      // Dry-run merge check: use git merge-tree to detect conflicts without touching worktree
      const mergeBase = execSync(`git merge-base ${baseBranch} ${wtBranch}`, { cwd: CWD, encoding: "utf-8" }).trim();
      const mergeTree = execSync(`git merge-tree ${mergeBase} ${baseBranch} ${wtBranch}`, { cwd: CWD, encoding: "utf-8" });
      const hasConflict = mergeTree.includes("<<<<<<<");
      if (hasConflict) {
        res.end(JSON.stringify({ status: "conflict", message: "检测到合并冲突" }));
      } else {
        res.end(JSON.stringify({ status: "clean", message: "无冲突，可以合并" }));
      }
    } catch (e) {
      res.end(JSON.stringify({ status: "unknown", message: e.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/sync-upstream") {
    // Full sync: temp commit if dirty → rebase → restore
    const script = `
      set -e
      DIRTY=0
      if [ -n "$(git status --short)" ]; then
        echo ">>> Uncommitted changes detected, creating temp commit..."
        git add -A
        git commit -m "wip: temp commit before sync"
        DIRTY=1
      fi
      echo ">>> Rebasing onto ${baseBranch}..."
      if git rebase ${baseBranch}; then
        echo ">>> Rebase succeeded"
        if [ "$DIRTY" = "1" ]; then
          echo ">>> Restoring uncommitted changes..."
          git reset HEAD~1
        fi
        echo ">>> Sync complete"
      else
        echo ">>> Rebase failed, aborting..."
        git rebase --abort
        if [ "$DIRTY" = "1" ]; then
          git reset HEAD~1
        fi
        exit 1
      fi
    `;
    sseExec("bash", ["-c", script], { cwd: CWD }, res);
    return;
  }

  if (req.method === "POST" && req.url === "/run-checks") {
    sseExec("bash", ["-c", "make typecheck && make test"], { cwd: CWD }, res);
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
    mergeState = "running";
    const child = sseExec("bash", [join(WORKTREE_DIR, "merge.sh")], { cwd: CWD }, res);
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
    deleteState = "running";
    const child = sseExec("make", ["-C", MAIN_REPO, "wt-delete", `NAME=${WT_NAME}`], {}, res);
    child.on("close", (code) => {
      deleteState = code === 0 ? "success" : "failed";
    });
    return;
  }

  // Serve video/media files from web/test-results/
  if (req.method === "GET" && req.url.startsWith("/videos/")) {
    const relPath = decodeURIComponent(req.url.slice("/videos/".length));
    const filePath = join(TEST_RESULTS_DIR, relPath);

    // Security: prevent path traversal
    if (!filePath.startsWith(TEST_RESULTS_DIR)) {
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
      ".webm": "video/webm",
      ".mp4": "video/mp4",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
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

  res.writeHead(404);
  res.end("Not found");
});

server.listen(0, () => {
  const port = server.address().port;
  const url = `http://localhost:${port}`;
  console.log(`PR Report Viewer: ${url}`);
  console.log(`Worktree: ${WT_NAME}`);
  console.log("Press Ctrl+C to stop.\n");

  // Auto-open browser (macOS)
  try {
    execSync(`open "${url}"`);
  } catch {
    console.log(`Open ${url} in your browser.`);
  }
});
