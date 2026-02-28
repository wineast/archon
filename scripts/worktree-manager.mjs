#!/usr/bin/env node
/**
 * Worktree Manager
 * Interactive web UI for managing git worktrees and branches.
 * Zero external dependencies.
 *
 * Usage:
 *   node scripts/worktree-manager.mjs
 *   make wt-manage
 */

import { createServer } from "node:http";
import { execSync, spawn } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = execSync("git rev-parse --show-toplevel", {
  encoding: "utf-8",
}).trim();
const WORKTREES_DIR = join(PROJECT_ROOT, ".worktrees");

// ── Helpers ──────────────────────────────────────────────────────────────

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 15000,
      ...opts,
    }).trim();
  } catch {
    return "";
  }
}

function parseWorktrees() {
  const raw = exec("git worktree list --porcelain");
  if (!raw) return [];
  const entries = [];
  let cur = {};
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (cur.path) entries.push(cur);
      cur = { path: line.slice(9) };
    } else if (line.startsWith("HEAD ")) {
      cur.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      cur.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      cur.bare = true;
    } else if (line === "detached") {
      cur.detached = true;
    }
  }
  if (cur.path) entries.push(cur);
  return entries;
}

function getWorktreeInfo() {
  const all = parseWorktrees();
  const main = all.find((w) => w.path === PROJECT_ROOT);
  const worktrees = all.filter((w) => w.path !== PROJECT_ROOT && !w.bare);

  return worktrees.map((wt) => {
    const name = wt.path.split("/").pop();
    const metaPath = join(wt.path, ".worktree", "meta.json");
    let meta = {};
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {}
    }

    // Last commit info
    const logLine = exec(
      `git log -1 --format="%h|%s|%cr|%an" ${wt.branch || wt.head} --`
    );
    const [hash, subject, date, author] = logLine.split("|");

    // Dirty check
    const dirty =
      exec(`git -C "${wt.path}" status --porcelain`).length > 0;

    // Merge status: is this branch fully merged into its base?
    const baseBranch = meta.baseBranch || "dev";
    let merged = false;
    if (wt.branch) {
      const mergedBranches = exec(
        `git branch --merged ${baseBranch} --format="%(refname:short)"`
      );
      merged = mergedBranches
        .split("\n")
        .some((b) => b.trim() === wt.branch);
    }

    // Commit count ahead of base
    const ahead = wt.branch
      ? parseInt(
          exec(
            `git rev-list --count ${baseBranch}..${wt.branch}`
          ) || "0",
          10
        )
      : 0;

    // Check if dev server is running
    const devPort = meta.dev;
    let running = false;
    if (devPort) {
      const pid = exec(`lsof -ti:${devPort} 2>/dev/null`);
      running = pid.length > 0;
    }

    // Reports in .worktree/
    const wtDir = join(wt.path, ".worktree");
    let reports = [];
    if (existsSync(wtDir)) {
      try {
        reports = readdirSync(wtDir).filter((f) => f.endsWith(".md"));
      } catch {}
    }

    return {
      name,
      path: wt.path,
      branch: wt.branch || "(detached)",
      baseBranch,
      head: hash || wt.head?.slice(0, 7),
      subject: subject || "",
      date: date || "",
      author: author || "",
      dirty,
      merged,
      ahead,
      devPort,
      running,
      reports,
      meta,
    };
  });
}

function getOrphanBranches() {
  // Branches that have been merged into dev but still exist
  const mergedRaw = exec(
    `git branch --merged dev --list "dev-*" --format="%(refname:short)|%(committerdate:short)|%(committerdate:relative)|%(subject)"`
  );
  if (!mergedRaw) return [];

  // Get active worktree branches
  const activeWtBranches = new Set(
    parseWorktrees()
      .filter((w) => w.branch)
      .map((w) => w.branch)
  );

  return mergedRaw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [branch, dateAbs, dateRel, subject] = line.split("|");
      return {
        branch: branch.trim(),
        date: dateAbs,
        dateRel,
        subject: subject || "",
        hasWorktree: activeWtBranches.has(branch.trim()),
      };
    })
    .filter((b) => !b.hasWorktree); // Only orphans (no active worktree)
}

function getUnmergedBranches() {
  const raw = exec(
    `git branch --no-merged dev --list "dev-*" --format="%(refname:short)|%(committerdate:short)|%(committerdate:relative)|%(subject)"`
  );
  if (!raw) return [];

  const activeWtBranches = new Set(
    parseWorktrees()
      .filter((w) => w.branch)
      .map((w) => w.branch)
  );

  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [branch, dateAbs, dateRel, subject] = line.split("|");
      return {
        branch: branch.trim(),
        date: dateAbs,
        dateRel,
        subject: subject || "",
        hasWorktree: activeWtBranches.has(branch.trim()),
      };
    })
    .filter((b) => !b.hasWorktree);
}

// ── SSE command runner ───────────────────────────────────────────────────

function runCommand(res, cmd, args, cwd) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const child = spawn(cmd, args, {
    cwd: cwd || PROJECT_ROOT,
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: true,
  });

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  child.stdout.on("data", (d) => {
    for (const line of d.toString().split("\n")) {
      if (line) send("stdout", line);
    }
  });

  child.stderr.on("data", (d) => {
    for (const line of d.toString().split("\n")) {
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
}

// ── HTML ─────────────────────────────────────────────────────────────────

function buildHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Worktree Manager</title>
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
  .container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 1.5em; margin-bottom: 4px; }
  .subtitle { color: var(--text-muted); font-size: 0.85em; margin-bottom: 24px; }

  /* Stats bar */
  .stats {
    display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
  }
  .stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 20px; min-width: 140px;
  }
  .stat-value { font-size: 1.8em; font-weight: 700; }
  .stat-label { font-size: 0.75em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

  /* Tabs */
  .tabs {
    display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 20px;
  }
  .tab {
    padding: 8px 16px; font-size: 0.85em; color: var(--text-muted);
    cursor: pointer; border-bottom: 2px solid transparent;
    background: none; border-top: none; border-left: none; border-right: none;
    font-family: inherit; transition: all 0.15s;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); }
  .tab .count {
    background: var(--border); border-radius: 10px; padding: 1px 8px;
    font-size: 0.85em; margin-left: 6px;
  }

  .panel { display: none; }
  .panel.active { display: block; }

  /* Table */
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th {
    text-align: left; padding: 8px 12px; color: var(--text-muted);
    font-weight: 500; font-size: 0.8em; text-transform: uppercase;
    letter-spacing: 0.5px; border-bottom: 1px solid var(--border);
  }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:hover td { background: rgba(88,166,255,0.04); }
  tr.selected td { background: rgba(88,166,255,0.08); }

  /* Badges */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 500;
    white-space: nowrap;
  }
  .badge-merged { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge-unmerged { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .badge-dirty { background: rgba(248,81,73,0.15); color: var(--red); }
  .badge-clean { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge-running { background: rgba(88,166,255,0.15); color: var(--accent); }
  .badge-ahead { background: rgba(188,140,255,0.15); color: var(--purple); }

  .branch-name {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 0.9em; color: var(--accent);
  }
  .commit-hash {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 0.9em; color: var(--text-muted);
  }
  .commit-msg { color: var(--text); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .commit-date { color: var(--text-muted); font-size: 0.85em; white-space: nowrap; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 6px; font-size: 0.8em;
    font-weight: 500; cursor: pointer; border: 1px solid var(--border);
    background: var(--surface); color: var(--text); font-family: inherit;
    transition: all 0.15s;
  }
  .btn:hover { background: var(--border); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-danger { border-color: rgba(248,81,73,0.4); color: var(--red); }
  .btn-danger:hover { background: rgba(248,81,73,0.15); }
  .btn-primary { border-color: rgba(88,166,255,0.4); color: var(--accent); }
  .btn-primary:hover { background: rgba(88,166,255,0.15); }

  .actions { display: flex; gap: 8px; align-items: center; }
  .bulk-actions {
    display: flex; gap: 8px; align-items: center;
    margin-bottom: 16px; padding: 10px 14px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  }
  .bulk-actions .info { font-size: 0.8em; color: var(--text-muted); margin-right: auto; }

  /* Select all checkbox */
  .check { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent); }

  /* Terminal */
  .terminal {
    display: none; margin-top: 16px; background: var(--terminal-bg);
    border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
  }
  .terminal.visible { display: block; }
  .terminal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 14px; background: var(--surface); border-bottom: 1px solid var(--border);
    font-size: 0.8em; color: var(--text-muted);
  }
  .terminal-content {
    padding: 12px; max-height: 300px; overflow-y: auto;
    font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.8em;
    line-height: 1.5;
  }
  .terminal-content .stdout { color: var(--text); }
  .terminal-content .stderr { color: var(--red); }
  .terminal-content .exit-success { color: var(--green); margin-top: 8px; }
  .terminal-content .exit-fail { color: var(--red); margin-top: 8px; }

  .spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid var(--border); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state {
    text-align: center; padding: 48px 16px; color: var(--text-muted);
  }
  .empty-state .icon { font-size: 2.5em; margin-bottom: 8px; opacity: 0.5; }

  /* Refresh button */
  .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .refresh-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 1.1em; padding: 4px 8px; border-radius: 4px;
  }
  .refresh-btn:hover { color: var(--text); background: var(--surface); }
</style>
</head>
<body>
<div class="container">
  <div class="header-row">
    <div>
      <h1>Worktree Manager</h1>
      <div class="subtitle" id="subtitle">Loading...</div>
    </div>
    <button class="refresh-btn" onclick="refresh()" title="Refresh">&#x21bb;</button>
  </div>

  <div class="stats" id="stats"></div>

  <div class="tabs" id="tabsBar"></div>

  <div id="panels"></div>

  <div class="terminal" id="terminal">
    <div class="terminal-header">
      <span>Terminal</span>
      <button class="btn" onclick="closeTerminal()" style="padding:2px 8px;font-size:0.75em;">Close</button>
    </div>
    <div class="terminal-content" id="termContent"></div>
  </div>
</div>

<script>
var data = null;

function refresh() {
  fetch("/api/data").then(function(r) { return r.json(); }).then(function(d) {
    data = d;
    render();
  });
}

function render() {
  // Stats
  var statsEl = document.getElementById("stats");
  statsEl.innerHTML =
    stat(data.worktrees.length, "Active Worktrees") +
    stat(data.orphanBranches.length, "Merged Branches") +
    stat(data.unmergedBranches.length, "Unmerged Branches") +
    stat(data.worktrees.filter(function(w){return w.merged}).length, "Ready to Delete");

  document.getElementById("subtitle").textContent =
    "Project: " + data.projectRoot.split("/").pop() +
    " \\u2022 Current branch: " + data.currentBranch;

  // Tabs
  var tabs = [
    { id: "worktrees", label: "Active Worktrees", count: data.worktrees.length },
    { id: "merged", label: "Merged Branches", count: data.orphanBranches.length },
    { id: "unmerged", label: "Unmerged Branches", count: data.unmergedBranches.length },
  ];

  var tabsBar = document.getElementById("tabsBar");
  tabsBar.innerHTML = tabs.map(function(t) {
    return '<button class="tab" data-tab="' + t.id + '">' +
      t.label + '<span class="count">' + t.count + '</span></button>';
  }).join("");

  // Panels
  var panels = document.getElementById("panels");
  panels.innerHTML =
    '<div class="panel" id="panel-worktrees">' + renderWorktrees() + '</div>' +
    '<div class="panel" id="panel-merged">' + renderMergedBranches() + '</div>' +
    '<div class="panel" id="panel-unmerged">' + renderUnmergedBranches() + '</div>';

  // Activate tab
  var activeTab = document.querySelector(".tab.active");
  var activeId = activeTab ? activeTab.dataset.tab : "worktrees";
  activateTab(activeId);

  tabsBar.querySelectorAll(".tab").forEach(function(el) {
    el.addEventListener("click", function() {
      activateTab(el.dataset.tab);
    });
  });
}

function activateTab(id) {
  document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
  document.querySelectorAll(".panel").forEach(function(p) { p.classList.remove("active"); });
  var tab = document.querySelector('[data-tab="' + id + '"]');
  if (tab) tab.classList.add("active");
  var panel = document.getElementById("panel-" + id);
  if (panel) panel.classList.add("active");
}

function stat(value, label) {
  return '<div class="stat"><div class="stat-value">' + value + '</div>' +
    '<div class="stat-label">' + label + '</div></div>';
}

function renderWorktrees() {
  if (!data.worktrees.length) {
    return '<div class="empty-state"><div class="icon">\\ud83c\\udf33</div>No active worktrees</div>';
  }
  var html = '<table><thead><tr>' +
    '<th>Name</th><th>Branch</th><th>Last Commit</th><th>Status</th><th>Actions</th>' +
    '</tr></thead><tbody>';

  data.worktrees.forEach(function(wt) {
    var badges = [];
    if (wt.merged) badges.push('<span class="badge badge-merged">\\u2705 Merged</span>');
    else if (wt.ahead > 0) badges.push('<span class="badge badge-ahead">+' + wt.ahead + ' ahead</span>');
    if (wt.dirty) badges.push('<span class="badge badge-dirty">Dirty</span>');
    else badges.push('<span class="badge badge-clean">Clean</span>');
    if (wt.running) badges.push('<span class="badge badge-running">\\u25cf Running :' + wt.devPort + '</span>');

    var deleteAttr = wt.merged
      ? 'data-action="delete-wt" data-name="' + esc(wt.name) + '"'
      : 'data-action="delete-wt-confirm" data-name="' + esc(wt.name) + '"';

    html += '<tr>' +
      '<td><strong>' + esc(wt.name) + '</strong>' +
        '<div style="font-size:0.8em;color:var(--text-muted)">base: ' + esc(wt.baseBranch) + '</div></td>' +
      '<td><span class="branch-name">' + esc(wt.branch) + '</span></td>' +
      '<td><span class="commit-hash">' + esc(wt.head) + '</span> ' +
        '<span class="commit-msg">' + esc(wt.subject) + '</span>' +
        '<div class="commit-date">' + esc(wt.date) + '</div></td>' +
      '<td>' + badges.join(" ") + '</td>' +
      '<td class="actions">' +
        '<button class="btn btn-danger" ' + deleteAttr + '>Delete</button>' +
      '</td></tr>';
  });

  html += '</tbody></table>';
  return html;
}

function renderMergedBranches() {
  if (!data.orphanBranches.length) {
    return '<div class="empty-state"><div class="icon">\\u2728</div>No orphaned merged branches \\u2014 all clean!</div>';
  }

  var html = '<div class="bulk-actions">' +
    '<input type="checkbox" class="check" id="selectAllMerged" data-action="toggle-all-merged">' +
    '<span class="info"><span id="mergedSelectedCount">0</span> selected</span>' +
    '<button class="btn btn-danger" id="btnBulkDelete" data-action="bulk-delete" disabled>Delete Selected</button>' +
    '<button class="btn btn-danger" data-action="delete-all-merged" data-count="' + data.orphanBranches.length + '">Delete All (' + data.orphanBranches.length + ')</button>' +
    '</div>';

  html += '<table><thead><tr>' +
    '<th style="width:30px"><input type="checkbox" class="check" data-action="toggle-all-merged"></th>' +
    '<th>Branch</th><th>Last Commit</th><th>Date</th><th>Actions</th>' +
    '</tr></thead><tbody>';

  data.orphanBranches.forEach(function(b, i) {
    html += '<tr>' +
      '<td><input type="checkbox" class="check merged-check" data-branch="' + esc(b.branch) + '" data-action="merged-check"></td>' +
      '<td><span class="branch-name">' + esc(b.branch) + '</span></td>' +
      '<td><span class="commit-msg">' + esc(b.subject) + '</span></td>' +
      '<td><span class="commit-date">' + esc(b.dateRel) + ' (' + esc(b.date) + ')</span></td>' +
      '<td class="actions">' +
        '<button class="btn btn-danger" data-action="delete-branch" data-name="' + esc(b.branch) + '">Delete</button>' +
      '</td></tr>';
  });

  html += '</tbody></table>';
  return html;
}

function renderUnmergedBranches() {
  if (!data.unmergedBranches.length) {
    return '<div class="empty-state"><div class="icon">\\ud83d\\udce6</div>No orphaned unmerged branches</div>';
  }

  var html = '<table><thead><tr>' +
    '<th>Branch</th><th>Last Commit</th><th>Date</th><th>Actions</th>' +
    '</tr></thead><tbody>';

  data.unmergedBranches.forEach(function(b) {
    html += '<tr>' +
      '<td><span class="branch-name">' + esc(b.branch) + '</span></td>' +
      '<td><span class="commit-msg">' + esc(b.subject) + '</span></td>' +
      '<td><span class="commit-date">' + esc(b.dateRel) + ' (' + esc(b.date) + ')</span></td>' +
      '<td class="actions">' +
        '<button class="btn btn-danger" data-action="force-delete-branch" data-name="' + esc(b.branch) + '">Force Delete</button>' +
      '</td></tr>';
  });

  html += '</tbody></table>';
  return html;
}

function esc(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// Selection helpers
function toggleAllMerged(checked) {
  document.querySelectorAll(".merged-check").forEach(function(cb) { cb.checked = checked; });
  updateMergedCount();
}

function updateMergedCount() {
  var checked = document.querySelectorAll(".merged-check:checked");
  var el = document.getElementById("mergedSelectedCount");
  if (el) el.textContent = checked.length;
  var btn = document.getElementById("btnBulkDelete");
  if (btn) btn.disabled = checked.length === 0;
}

// Event delegation — all actions via data-action attributes
document.addEventListener("click", function(e) {
  var el = e.target.closest("[data-action]");
  if (!el) return;
  var action = el.dataset.action;
  var name = el.dataset.name || "";

  if (action === "delete-wt") {
    runSSE("/api/delete-worktree?name=" + encodeURIComponent(name));
  } else if (action === "delete-wt-confirm") {
    if (confirm("This worktree has unmerged changes. Are you sure?\\n\\n" + name)) {
      runSSE("/api/delete-worktree?name=" + encodeURIComponent(name));
    }
  } else if (action === "delete-branch") {
    runSSE("/api/delete-branch?name=" + encodeURIComponent(name));
  } else if (action === "force-delete-branch") {
    if (confirm("This branch has NOT been merged! Delete anyway?\\n\\n" + name)) {
      runSSE("/api/force-delete-branch?name=" + encodeURIComponent(name));
    }
  } else if (action === "bulk-delete") {
    var branches = [];
    document.querySelectorAll(".merged-check:checked").forEach(function(cb) {
      branches.push(cb.dataset.branch);
    });
    if (!branches.length) return;
    if (!confirm("Delete " + branches.length + " merged branches?")) return;
    runSSE("/api/bulk-delete-branches?branches=" + encodeURIComponent(branches.join(",")));
  } else if (action === "delete-all-merged") {
    var count = el.dataset.count || "?";
    if (!confirm("Delete ALL " + count + " merged branches?\\nThis cannot be undone.")) return;
    runSSE("/api/delete-all-merged");
  } else if (action === "toggle-all-merged") {
    toggleAllMerged(el.checked);
  } else if (action === "merged-check") {
    updateMergedCount();
  }
});

// Terminal & SSE
function appendLine(text, cls) {
  var div = document.createElement("div");
  div.className = cls;
  div.textContent = text;
  var tc = document.getElementById("termContent");
  tc.appendChild(div);
  tc.scrollTop = tc.scrollHeight;
}

function runSSE(url) {
  var term = document.getElementById("terminal");
  var tc = document.getElementById("termContent");
  term.classList.add("visible");
  tc.innerHTML = "";

  fetch(url, { method: "POST" }).then(function(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = "";
    function read() {
      reader.read().then(function(result) {
        if (result.done) { return; }
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
                appendLine("\\nDone (exit 0)", "exit-success");
              } else {
                appendLine("\\nFailed (exit " + msg.data + ")", "exit-fail");
              }
              setTimeout(refresh, 500);
            }
            else if (msg.type === "error") appendLine("Error: " + msg.data, "stderr");
          } catch(e) {}
        }
        read();
      });
    }
    read();
  });
}

function closeTerminal() {
  document.getElementById("terminal").classList.remove("visible");
}

refresh();
<\/script>
</body>
</html>`;
}

// ── HTTP Server ──────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (path === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(buildHTML());
    return;
  }

  if (path === "/api/data" && req.method === "GET") {
    const currentBranch = exec("git rev-parse --abbrev-ref HEAD");
    const result = {
      projectRoot: PROJECT_ROOT,
      currentBranch,
      worktrees: getWorktreeInfo(),
      orphanBranches: getOrphanBranches(),
      unmergedBranches: getUnmergedBranches(),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (path === "/api/delete-worktree" && req.method === "POST") {
    const name = url.searchParams.get("name");
    if (!name) {
      res.writeHead(400);
      res.end("Missing name");
      return;
    }
    runCommand(res, "make", [`wt-delete`, `NAME=${name}`], PROJECT_ROOT);
    return;
  }

  if (path === "/api/delete-branch" && req.method === "POST") {
    const name = url.searchParams.get("name");
    if (!name) {
      res.writeHead(400);
      res.end("Missing name");
      return;
    }
    runCommand(res, "git", ["branch", "-d", name], PROJECT_ROOT);
    return;
  }

  if (path === "/api/force-delete-branch" && req.method === "POST") {
    const name = url.searchParams.get("name");
    if (!name) {
      res.writeHead(400);
      res.end("Missing name");
      return;
    }
    runCommand(res, "git", ["branch", "-D", name], PROJECT_ROOT);
    return;
  }

  if (path === "/api/bulk-delete-branches" && req.method === "POST") {
    const branches = url.searchParams.get("branches");
    if (!branches) {
      res.writeHead(400);
      res.end("Missing branches");
      return;
    }
    const list = branches.split(",").filter(Boolean);
    runCommand(
      res,
      "git",
      ["branch", "-d", ...list],
      PROJECT_ROOT
    );
    return;
  }

  if (path === "/api/delete-all-merged" && req.method === "POST") {
    // Delete all merged dev-* branches that don't have active worktrees
    const orphans = getOrphanBranches();
    if (!orphans.length) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });
      res.write(
        `data: ${JSON.stringify({ type: "stdout", data: "No branches to delete" })}\n\n`
      );
      res.write(
        `data: ${JSON.stringify({ type: "exit", data: 0 })}\n\n`
      );
      res.end();
      return;
    }
    const names = orphans.map((b) => b.branch);
    runCommand(res, "git", ["branch", "-d", ...names], PROJECT_ROOT);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ── Start ────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || "0", 10);
server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const url = `http://localhost:${addr.port}`;
  console.log(`\n  Worktree Manager: ${url}\n`);

  // Auto-open in browser
  try {
    execSync(`open "${url}"`, { stdio: "ignore" });
  } catch {
    // Ignore if open fails (non-macOS)
  }
});
