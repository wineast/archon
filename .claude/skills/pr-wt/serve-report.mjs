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

function readReport() {
  return readFileSync(REPORT_PATH, "utf-8");
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

  /* Markdown styles */
  .report h1 { font-size: 1.75em; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 16px; }
  .report h2 { font-size: 1.35em; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin: 24px 0 12px; }
  .report h3 { font-size: 1.1em; margin: 16px 0 8px; }
  .report p { margin: 8px 0; }
  .report ul, .report ol { padding-left: 24px; margin: 8px 0; }
  .report li { margin: 4px 0; }
  .report code {
    background: var(--surface);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  .report pre {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px 16px;
    overflow-x: auto;
    margin: 8px 0;
  }
  .report pre code {
    background: none;
    padding: 0;
  }
  .report blockquote {
    border-left: 3px solid var(--border);
    padding-left: 12px;
    color: var(--text-muted);
    margin: 8px 0;
  }
  .report table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }
  .report th, .report td {
    border: 1px solid var(--border);
    padding: 8px 12px;
    text-align: left;
  }
  .report th {
    background: var(--surface);
    font-weight: 600;
  }
  .report a { color: var(--accent); text-decoration: none; }
  .report a:hover { text-decoration: underline; }
  .report strong { font-weight: 600; }

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

  .btn-group {
    display: flex;
    gap: 8px;
    align-items: center;
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

  /* Video player */
  .report video {
    width: 100%;
    max-width: 720px;
    border-radius: 6px;
    border: 1px solid var(--border);
    margin: 8px 0;
  }
  .video-item {
    margin: 12px 0;
  }
  .video-label {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

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
<div class="container">
  <div class="report" id="report"></div>

  <div class="actions">
    <div class="actions-header">
      <span class="actions-title">Actions</span>
      <span id="merge-status"></span>
      <span id="delete-status"></span>
    </div>
    <div class="btn-group">
      <button class="btn btn-merge" id="btn-merge" onclick="doMerge()">
        Merge to upstream
      </button>
      <button class="btn btn-delete" id="btn-delete" onclick="doDelete()" style="display:none">
        Delete worktree
      </button>
    </div>
    <div class="terminal" id="terminal">
      <div class="terminal-content" id="terminal-content"></div>
    </div>
  </div>
</div>

<script>
  // Render markdown
  const md = ${escapedMd};
  document.getElementById("report").innerHTML = marked.parse(md);

  // Post-process: convert video links to inline <video> players
  document.querySelectorAll(".report a[href]").forEach(a => {
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

  const terminal = document.getElementById("terminal");
  const termContent = document.getElementById("terminal-content");
  const btnMerge = document.getElementById("btn-merge");
  const btnDelete = document.getElementById("btn-delete");
  const mergeStatus = document.getElementById("merge-status");
  const deleteStatus = document.getElementById("delete-status");

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

  function doMerge() {
    btnMerge.disabled = true;
    btnMerge.innerHTML = '<span class="spinner"></span> Merging...';
    setStatus(mergeStatus, "running", "Running");
    termContent.innerHTML = "";

    runSSE("/merge", (success) => {
      if (success) {
        setStatus(mergeStatus, "success", "Merged");
        btnMerge.innerHTML = "Merged";
        btnDelete.style.display = "";
      } else {
        setStatus(mergeStatus, "failed", "Failed");
        btnMerge.innerHTML = "Merge failed";
      }
    });
  }

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

  if (req.method === "POST" && req.url === "/merge") {
    if (mergeState === "running") {
      res.writeHead(409);
      res.end("Merge already running");
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
