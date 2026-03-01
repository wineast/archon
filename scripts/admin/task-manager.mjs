#!/usr/bin/env node
/**
 * Task Manager
 * Read-only kanban + heartbeat scheduler for todo/issue files.
 * Zero external dependencies.
 *
 * Usage:
 *   node scripts/admin/task-manager.mjs
 *   make task-manage
 */

import { createServer } from "node:http";
import { execSync, spawn } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  watch,
} from "node:fs";
import { join, relative } from "node:path";

const PROJECT_ROOT = execSync("git rev-parse --show-toplevel", {
  encoding: "utf-8",
}).trim();
const WORKTREES_DIR = join(PROJECT_ROOT, ".worktrees");
const TODO_DIR = join(PROJECT_ROOT, "todo");
const ISSUES_DIR = join(PROJECT_ROOT, "issues");

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

/** Parse YAML frontmatter with pure regex (zero deps) */
function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kv) {
      let val = kv[2].trim();
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[kv[1]] = val;
    }
  }
  return fm;
}

/** Extract markdown title (first # heading) */
function parseTitle(content) {
  const m = content.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : "(untitled)";
}

// ── Data Layer ───────────────────────────────────────────────────────────

function scanTasks() {
  const tasks = [];

  // Scan todo/ subdirectories
  const todoFolders = ["pending", "ready", "running", "backlog", "done"];
  for (const folder of todoFolders) {
    const dir = join(TODO_DIR, folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      const title = parseTitle(content);
      const id = file.replace(/\.md$/, "");
      tasks.push({
        type: "todo",
        id,
        title,
        priority: fm.priority || "P3",
        status: fm.status || folder,
        worktree: fm.worktree || "",
        path: relative(PROJECT_ROOT, filePath),
        folder,
      });
    }
  }

  // Scan issues/ subdirectories
  const issueFolders = ["open", "ready", "running", "closed"];
  for (const folder of issueFolders) {
    const dir = join(ISSUES_DIR, folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      const title = parseTitle(content);
      const id = file.replace(/\.md$/, "");
      tasks.push({
        type: "issue",
        id,
        title,
        priority: fm.priority || "P3",
        status: fm.status || folder,
        worktree: fm.worktree || "",
        path: relative(PROJECT_ROOT, filePath),
        folder,
      });
    }
  }

  return tasks;
}

function scanWorktrees() {
  if (!existsSync(WORKTREES_DIR)) return [];
  const result = [];

  for (const name of readdirSync(WORKTREES_DIR)) {
    const wtPath = join(WORKTREES_DIR, name);
    const wtDir = join(wtPath, ".worktree");
    if (!existsSync(wtDir)) continue;

    // Read task.json for task association
    let taskRef = null;
    const taskJsonPath = join(wtDir, "task.json");
    if (existsSync(taskJsonPath)) {
      try {
        taskRef = JSON.parse(readFileSync(taskJsonPath, "utf-8"));
      } catch {}
    }

    // Read meta.json
    let meta = {};
    const metaPath = join(wtDir, "meta.json");
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {}
    }

    // Detect chain reports
    const reqChain = {
      "REQ.md": existsSync(join(wtDir, "REQ.md")),
      "IMPL_REPORT.md": existsSync(join(wtDir, "IMPL_REPORT.md")),
      "ACCEPT_REPORT.md": existsSync(join(wtDir, "ACCEPT_REPORT.md")),
      "CAP_GUARD.md": existsSync(join(wtDir, "CAP_GUARD.md")),
      "CAP_GUARD_REPORT.md": existsSync(join(wtDir, "CAP_GUARD_REPORT.md")),
    };
    const defectChain = {
      "DEFECT.md": existsSync(join(wtDir, "DEFECT.md")),
      "FIX_REPORT.md": existsSync(join(wtDir, "FIX_REPORT.md")),
      "VERIFY_REPORT.md": existsSync(join(wtDir, "VERIFY_REPORT.md")),
      "TEST_SPEC.md": existsSync(join(wtDir, "TEST_SPEC.md")),
      "TEST_SPEC_REPORT.md": existsSync(join(wtDir, "TEST_SPEC_REPORT.md")),
    };

    // Determine which chain type (based on first report found)
    const hasReq = Object.values(reqChain).some(Boolean);
    const hasDefect = Object.values(defectChain).some(Boolean);

    result.push({
      name,
      path: wtPath,
      taskRef,
      meta,
      reqChain: hasReq ? reqChain : null,
      defectChain: hasDefect ? defectChain : null,
    });
  }

  return result;
}

function buildData() {
  const tasks = scanTasks();
  const worktrees = scanWorktrees();

  // Enrich tasks with worktree chain data
  for (const task of tasks) {
    task.chain = null;
    task.remoteUrl = "";
    if (task.worktree) {
      const wt = worktrees.find((w) => w.name === task.worktree);
      if (wt) {
        task.chain = wt.reqChain || wt.defectChain || null;
        // Remote URL from scheduler tracking
        const running = scheduler.running.get(task.id);
        if (running?.remoteUrl) {
          task.remoteUrl = running.remoteUrl;
        }
      }
    }
  }

  return {
    tasks,
    worktrees,
    scheduler: {
      enabled: scheduler.enabled,
      maxConcurrent: scheduler.maxConcurrent,
      runningCount: scheduler.running.size,
      readyCount: tasks.filter((t) => t.status === "ready").length,
    },
    stats: {
      total: tasks.length,
      ready: tasks.filter((t) => t.status === "ready").length,
      running: tasks.filter((t) => t.status === "running").length,
      completed: tasks.filter((t) => t.status === "done" || t.status === "closed").length,
      todoCount: tasks.filter((t) => t.type === "todo").length,
      issueCount: tasks.filter((t) => t.type === "issue").length,
    },
  };
}

// ── Scheduler ────────────────────────────────────────────────────────────

const LOG_MAX = 100;

const scheduler = {
  enabled: false,
  maxConcurrent: 5,
  scanInterval: 30000,
  timer: null,
  running: new Map(), // taskId -> { process, worktree, remoteUrl }
  logs: [],           // ring buffer, max LOG_MAX

  log(level, msg) {
    const entry = { time: new Date().toISOString(), level, msg };
    this.logs.push(entry);
    if (this.logs.length > LOG_MAX) this.logs.shift();
    console.log(`[scheduler][${level}] ${msg}`);
    broadcastSSE({ type: "scheduler-log", data: entry });
  },

  start() {
    if (this.enabled) return;
    this.enabled = true;
    this.log("info", "Scheduler started");
    this.tick();
    this.timer = setInterval(() => this.tick(), this.scanInterval);
    broadcastSSE({ type: "scheduler-state", data: { enabled: true } });
  },

  stop() {
    if (!this.enabled) return;
    this.enabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.log("info", "Scheduler stopped");
    broadcastSSE({ type: "scheduler-state", data: { enabled: false } });
  },

  toggle() {
    if (this.enabled) this.stop();
    else this.start();
    return this.enabled;
  },

  tick() {
    // 1. Check running tasks — remove dead processes
    for (const [taskId, info] of this.running) {
      if (info.process && info.process.exitCode !== null) {
        this.log("info", `Task "${taskId}" process exited (code ${info.process.exitCode})`);
        this.running.delete(taskId);
        broadcastSSE({ type: "refresh" });
      }
    }

    // 2. If capacity, dispatch ready tasks
    if (this.running.size >= this.maxConcurrent) {
      this.log("debug", `At capacity (${this.running.size}/${this.maxConcurrent}), skipping`);
      return;
    }

    const tasks = scanTasks().filter((t) => t.status === "ready");
    if (!tasks.length) return;

    // Sort by priority (P0 > P1 > P2 > P3)
    tasks.sort((a, b) => a.priority.localeCompare(b.priority));

    const slots = this.maxConcurrent - this.running.size;
    const toDispatch = tasks.slice(0, slots);

    for (const task of toDispatch) {
      this.dispatch(task);
    }
  },

  async dispatch(task) {
    const taskId = task.id;
    this.log("info", `Dispatching "${taskId}" (${task.type}, ${task.priority})`);

    // 1. Create worktree
    try {
      const createResult = exec(
        `node scripts/worktree.mjs create ${taskId}`,
        { timeout: 60000 }
      );
      this.log("info", `Worktree created for "${taskId}": ${createResult.split("\n").pop()}`);
    } catch (e) {
      this.log("error", `Failed to create worktree for "${taskId}": ${e.message}`);
      return;
    }

    const wtPath = join(WORKTREES_DIR, taskId);
    if (!existsSync(wtPath)) {
      this.log("error", `Worktree path not found after creation: ${wtPath}`);
      return;
    }

    // 2. Write .worktree/task.json
    const wtDir = join(wtPath, ".worktree");
    const taskJson = {
      type: task.type,
      id: taskId,
      path: task.path,
    };
    try {
      writeFileSync(join(wtDir, "task.json"), JSON.stringify(taskJson, null, 2));
    } catch (e) {
      this.log("error", `Failed to write task.json: ${e.message}`);
    }

    // 3. Update task frontmatter: status→running, worktree→<name>
    const taskFilePath = join(PROJECT_ROOT, task.path);
    try {
      let content = readFileSync(taskFilePath, "utf-8");
      content = content.replace(/^(---\r?\n[\s\S]*?\r?\n---)/, (match) => {
        let fm = match;
        // Update or add status
        if (/^status:/m.test(fm)) {
          fm = fm.replace(/^status:.*/m, `status: running`);
        } else {
          fm = fm.replace(/\n---$/, `\nstatus: running\n---`);
        }
        // Update or add worktree
        if (/^worktree:/m.test(fm)) {
          fm = fm.replace(/^worktree:.*/m, `worktree: ${taskId}`);
        } else {
          fm = fm.replace(/\n---$/, `\nworktree: ${taskId}\n---`);
        }
        return fm;
      });
      writeFileSync(taskFilePath, content);
    } catch (e) {
      this.log("error", `Failed to update task frontmatter: ${e.message}`);
    }

    // 4. Spawn claude --print with appropriate skill
    const skill = task.type === "todo" ? "/requirement" : "/diagnose";
    this.log("info", `Spawning claude ${skill} in ${wtPath}`);

    let stdout = "";
    let stderr = "";

    try {
      const child = spawn("claude", ["--print", skill], {
        cwd: wtPath,
        env: { ...process.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      const info = { process: child, worktree: taskId, remoteUrl: "" };
      this.running.set(taskId, info);

      child.stdout.on("data", (d) => {
        const text = d.toString();
        stdout += text;
        // Try to capture Remote URL
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch && !info.remoteUrl) {
          info.remoteUrl = urlMatch[0];
          this.log("info", `Remote URL for "${taskId}": ${info.remoteUrl}`);
          broadcastSSE({ type: "refresh" });
        }
      });

      child.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      child.on("error", (err) => {
        this.log("error", `Process error for "${taskId}": ${err.message}`);
        // Rollback status to ready
        this.rollbackStatus(task);
        this.running.delete(taskId);
        broadcastSSE({ type: "refresh" });
      });

      child.on("close", (code) => {
        this.log("info", `Task "${taskId}" completed (exit ${code})`);
        this.running.delete(taskId);
        broadcastSSE({ type: "refresh" });
      });

      broadcastSSE({ type: "refresh" });
    } catch (e) {
      this.log("error", `Failed to spawn claude for "${taskId}": ${e.message}`);
      this.rollbackStatus(task);
    }
  },

  rollbackStatus(task) {
    const taskFilePath = join(PROJECT_ROOT, task.path);
    try {
      let content = readFileSync(taskFilePath, "utf-8");
      content = content.replace(/^status:.*/m, "status: ready");
      writeFileSync(taskFilePath, content);
      this.log("info", `Rolled back "${task.id}" status to ready`);
    } catch (e) {
      this.log("error", `Failed to rollback status for "${task.id}": ${e.message}`);
    }
  },
};

// ── SSE ──────────────────────────────────────────────────────────────────

const sseClients = new Set();

function broadcastSSE(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

// File watchers for auto-refresh
function setupWatchers() {
  const dirs = [
    join(TODO_DIR, "pending"),
    join(TODO_DIR, "ready"),
    join(TODO_DIR, "running"),
    join(TODO_DIR, "backlog"),
    join(TODO_DIR, "done"),
    join(ISSUES_DIR, "open"),
    join(ISSUES_DIR, "ready"),
    join(ISSUES_DIR, "running"),
    join(ISSUES_DIR, "closed"),
  ];

  let debounce = null;
  const notify = () => {
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = null;
      broadcastSSE({ type: "refresh" });
    }, 500);
  };

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      watch(dir, { persistent: false }, notify);
    } catch {}
  }

  // Also watch worktrees for report changes
  if (existsSync(WORKTREES_DIR)) {
    try {
      watch(WORKTREES_DIR, { recursive: true, persistent: false }, (_, filename) => {
        if (filename && (filename.endsWith(".md") || filename.endsWith(".json"))) {
          notify();
        }
      });
    } catch {}
  }
}

// ── HTML ─────────────────────────────────────────────────────────────────

function buildHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Task Manager</title>
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
    --orange: #d18616;
    --terminal-bg: #010409;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }

  /* Header */
  .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  h1 { font-size: 1.5em; }
  .subtitle { color: var(--text-muted); font-size: 0.85em; margin-bottom: 24px; }
  .header-actions { display: flex; align-items: center; gap: 8px; }

  /* Stats bar */
  .stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 16px; min-width: 110px;
  }
  .stat-value { font-size: 1.6em; font-weight: 700; }
  .stat-label { font-size: 0.7em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

  /* Tabs */
  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
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

  /* Filter bar */
  .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .filter-bar label { font-size: 0.8em; color: var(--text-muted); }
  .filter-btn {
    padding: 3px 10px; border-radius: 12px; font-size: 0.75em; font-weight: 500;
    cursor: pointer; border: 1px solid var(--border); background: var(--surface);
    color: var(--text-muted); font-family: inherit; transition: all 0.15s;
  }
  .filter-btn:hover { color: var(--text); border-color: var(--text-muted); }
  .filter-btn.active { color: var(--accent); border-color: var(--accent); background: rgba(88,166,255,0.1); }

  /* Table */
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th {
    text-align: left; padding: 8px 10px; color: var(--text-muted);
    font-weight: 500; font-size: 0.8em; text-transform: uppercase;
    letter-spacing: 0.5px; border-bottom: 1px solid var(--border);
  }
  td { padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:hover td { background: rgba(88,166,255,0.04); }
  .title-cell { max-width: 350px; }
  .title-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Badges */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 500;
    white-space: nowrap;
  }
  .badge-todo { background: rgba(88,166,255,0.15); color: var(--accent); }
  .badge-issue { background: rgba(248,81,73,0.15); color: var(--red); }
  .badge-pending { background: rgba(139,148,158,0.15); color: var(--text-muted); }
  .badge-open { background: rgba(139,148,158,0.15); color: var(--text-muted); }
  .badge-ready { background: rgba(57,210,192,0.15); color: var(--cyan); }
  .badge-running { background: rgba(210,134,22,0.15); color: var(--orange); }
  .badge-done { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge-closed { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge-backlog { background: rgba(188,140,255,0.15); color: var(--purple); }

  .priority { font-weight: 600; font-size: 0.8em; }
  .p0 { color: var(--red); }
  .p1 { color: var(--orange); }
  .p2 { color: var(--yellow); }
  .p3 { color: var(--text-muted); }

  /* Chain dots */
  .chain-dots { display: flex; gap: 3px; align-items: center; }
  .chain-dot {
    width: 8px; height: 8px; border-radius: 50%;
    display: inline-block; cursor: default;
  }
  .chain-dot.present { background: var(--green); }
  .chain-dot.missing { background: var(--border); }

  /* Worktree link */
  .wt-link {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 0.85em; color: var(--accent); cursor: pointer;
    text-decoration: none;
  }
  .wt-link:hover { text-decoration: underline; }

  .remote-link { font-size: 0.8em; color: var(--cyan); text-decoration: none; }
  .remote-link:hover { text-decoration: underline; }

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
  .btn-primary { border-color: rgba(88,166,255,0.4); color: var(--accent); }
  .btn-primary:hover { background: rgba(88,166,255,0.15); }
  .btn-success { border-color: rgba(63,185,80,0.4); color: var(--green); }
  .btn-success:hover { background: rgba(63,185,80,0.15); }
  .btn-danger { border-color: rgba(248,81,73,0.4); color: var(--red); }
  .btn-danger:hover { background: rgba(248,81,73,0.15); }
  .refresh-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 1.1em; padding: 4px 8px; border-radius: 4px;
  }
  .refresh-btn:hover { color: var(--text); background: var(--surface); }

  /* Terminal / log panel */
  .log-panel {
    margin-top: 16px; background: var(--terminal-bg);
    border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
  }
  .log-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 14px; background: var(--surface); border-bottom: 1px solid var(--border);
    font-size: 0.8em; color: var(--text-muted);
  }
  .log-content {
    padding: 12px; max-height: 300px; overflow-y: auto;
    font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.8em;
    line-height: 1.5;
  }
  .log-entry { padding: 2px 0; }
  .log-time { color: var(--text-muted); margin-right: 8px; }
  .log-info { color: var(--text); }
  .log-error { color: var(--red); }
  .log-debug { color: var(--text-muted); }

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
</style>
</head>
<body>
<div class="container">
  <div class="header-row">
    <div>
      <h1>Task Manager</h1>
      <div class="subtitle" id="subtitle">Loading...</div>
    </div>
    <div class="header-actions">
      <button class="btn" id="schedulerBtn" onclick="toggleScheduler()">Scheduler OFF</button>
      <button class="refresh-btn" onclick="refresh()" title="Refresh">&#x21bb;</button>
    </div>
  </div>

  <div class="stats" id="stats"></div>

  <div class="tabs" id="tabsBar"></div>

  <div class="filter-bar" id="filterBar">
    <label>Priority:</label>
    <button class="filter-btn active" data-filter="all" onclick="setFilter('all',this)">All</button>
    <button class="filter-btn" data-filter="P0" onclick="setFilter('P0',this)">P0</button>
    <button class="filter-btn" data-filter="P1" onclick="setFilter('P1',this)">P1</button>
    <button class="filter-btn" data-filter="P2" onclick="setFilter('P2',this)">P2</button>
    <button class="filter-btn" data-filter="P3" onclick="setFilter('P3',this)">P3</button>
  </div>

  <div id="panels"></div>
</div>

<script>
var data = null;
var currentTab = "all";
var currentFilter = "all";

function refresh() {
  fetch("/api/data").then(function(r) { return r.json(); }).then(function(d) {
    data = d;
    render();
  });
}

function render() {
  if (!data) return;
  var s = data.stats;

  // Subtitle
  document.getElementById("subtitle").textContent =
    "Tasks: " + s.total +
    " \\u00b7 Running: " + s.running + "/" + data.scheduler.maxConcurrent +
    " \\u00b7 Ready: " + s.ready;

  // Scheduler button
  var sb = document.getElementById("schedulerBtn");
  if (data.scheduler.enabled) {
    sb.textContent = "Scheduler ON";
    sb.className = "btn btn-success";
  } else {
    sb.textContent = "Scheduler OFF";
    sb.className = "btn";
  }

  // Stats
  document.getElementById("stats").innerHTML =
    stat(s.total, "Total") +
    stat(s.ready, "Ready") +
    stat(s.running, "Running") +
    stat(s.completed, "Completed");

  // Tabs
  var running = data.tasks.filter(function(t){ return t.status==="running"; });
  var tabs = [
    { id: "all", label: "All", count: s.total },
    { id: "todo", label: "Todo", count: s.todoCount },
    { id: "issues", label: "Issues", count: s.issueCount },
    { id: "running", label: "Running", count: s.running },
    { id: "logs", label: "Logs", count: data.scheduler.logs ? data.scheduler.logs.length : 0 },
  ];

  document.getElementById("tabsBar").innerHTML = tabs.map(function(t) {
    return '<button class="tab' + (currentTab===t.id?" active":"") + '" data-tab="' + t.id + '">' +
      t.label + '<span class="count">' + t.count + '</span></button>';
  }).join("");

  document.getElementById("tabsBar").querySelectorAll(".tab").forEach(function(el) {
    el.addEventListener("click", function() {
      currentTab = el.dataset.tab;
      render();
    });
  });

  // Panels
  var panels = document.getElementById("panels");
  if (currentTab === "logs") {
    panels.innerHTML = renderLogs();
    document.getElementById("filterBar").style.display = "none";
  } else {
    document.getElementById("filterBar").style.display = "flex";
    var filtered = filterTasks();
    panels.innerHTML = renderTable(filtered);
  }
}

function filterTasks() {
  var tasks = data.tasks;
  if (currentTab === "todo") tasks = tasks.filter(function(t){ return t.type==="todo"; });
  else if (currentTab === "issues") tasks = tasks.filter(function(t){ return t.type==="issue"; });
  else if (currentTab === "running") tasks = tasks.filter(function(t){ return t.status==="running"; });

  if (currentFilter !== "all") {
    tasks = tasks.filter(function(t){ return t.priority===currentFilter; });
  }

  // Sort: running first, then ready, then by priority
  var order = { running: 0, ready: 1, open: 2, pending: 3, backlog: 4, done: 5, closed: 6 };
  tasks.sort(function(a, b) {
    var sa = order[a.status] !== undefined ? order[a.status] : 3;
    var sb = order[b.status] !== undefined ? order[b.status] : 3;
    if (sa !== sb) return sa - sb;
    return a.priority.localeCompare(b.priority);
  });

  return tasks;
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll(".filter-btn").forEach(function(b){ b.classList.remove("active"); });
  el.classList.add("active");
  render();
}

function stat(value, label) {
  return '<div class="stat"><div class="stat-value">' + value + '</div>' +
    '<div class="stat-label">' + label + '</div></div>';
}

function renderTable(tasks) {
  if (!tasks.length) {
    return '<div class="empty-state"><div class="icon">\\ud83d\\udccb</div>No tasks found</div>';
  }

  var html = '<table><thead><tr>' +
    '<th>Type</th><th>P</th><th>Title</th><th>Status</th><th>WT</th><th>Chain</th><th>Remote</th>' +
    '</tr></thead><tbody>';

  tasks.forEach(function(t) {
    var typeBadge = t.type === "todo"
      ? '<span class="badge badge-todo">Todo</span>'
      : '<span class="badge badge-issue">Issue</span>';

    var pClass = t.priority.toLowerCase();
    var prioHtml = '<span class="priority ' + pClass + '">' + esc(t.priority) + '</span>';

    var statusBadge = '<span class="badge badge-' + esc(t.status) + '">' + esc(t.status) + '</span>';

    var wtHtml = "";
    if (t.worktree) {
      wtHtml = '<a class="wt-link" href="#" onclick="openViewer(\\''+esc(t.worktree)+'\\');return false;">' + esc(t.worktree) + '</a>';
    } else {
      wtHtml = '<span style="color:var(--text-muted)">-</span>';
    }

    var chainHtml = renderChain(t.chain, t.type);

    var remoteHtml = "";
    if (t.remoteUrl) {
      remoteHtml = '<a class="remote-link" href="' + esc(t.remoteUrl) + '" target="_blank">\\ud83d\\udd17 Open</a>';
    }

    html += '<tr>' +
      '<td>' + typeBadge + '</td>' +
      '<td>' + prioHtml + '</td>' +
      '<td class="title-cell"><span class="title-text" title="' + esc(t.title) + '">' + esc(t.title) + '</span>' +
        '<div style="font-size:0.75em;color:var(--text-muted)">' + esc(t.id) + '</div></td>' +
      '<td>' + statusBadge + '</td>' +
      '<td>' + wtHtml + '</td>' +
      '<td>' + chainHtml + '</td>' +
      '<td>' + remoteHtml + '</td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

function renderChain(chain, type) {
  if (!chain) return "";
  var keys = Object.keys(chain);
  var dots = keys.map(function(k) {
    var present = chain[k];
    var cls = present ? "present" : "missing";
    var label = k.replace(/\\.md$/, "");
    return '<span class="chain-dot ' + cls + '" title="' + esc(label) + (present ? " \\u2713" : " \\u2717") + '"></span>';
  }).join("");
  return '<div class="chain-dots">' + dots + '</div>';
}

function renderLogs() {
  var html = '<div class="log-panel"><div class="log-header"><span>Scheduler Logs</span>' +
    '<button class="btn" onclick="refreshLogs()" style="padding:2px 8px;font-size:0.75em;">Refresh</button></div>' +
    '<div class="log-content" id="logContent">';

  if (!data.scheduler.logs || !data.scheduler.logs.length) {
    html += '<div style="color:var(--text-muted);text-align:center;padding:20px;">No logs yet</div>';
  } else {
    data.scheduler.logs.slice().reverse().forEach(function(entry) {
      var cls = "log-" + entry.level;
      var time = entry.time.split("T")[1].split(".")[0];
      html += '<div class="log-entry"><span class="log-time">' + time + '</span>' +
        '<span class="' + cls + '">' + esc(entry.msg) + '</span></div>';
    });
  }

  html += '</div></div>';
  return html;
}

function refreshLogs() {
  fetch("/api/scheduler/logs").then(function(r){ return r.json(); }).then(function(logs) {
    if (data) data.scheduler.logs = logs;
    render();
  });
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function toggleScheduler() {
  fetch("/api/scheduler/toggle", { method: "POST" })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (data) data.scheduler.enabled = d.enabled;
      render();
    });
}

function openViewer(wtName) {
  fetch("/api/open-viewer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worktree: wtName })
  }).then(function(r){ return r.json(); }).then(function(d) {
    if (d.error) {
      console.error("open-viewer:", d.error);
    }
  });
}

// SSE auto-refresh
function connectSSE() {
  var es = new EventSource("/api/events");
  es.onmessage = function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === "refresh") {
        refresh();
      } else if (msg.type === "scheduler-state") {
        if (data) data.scheduler.enabled = msg.data.enabled;
        render();
      } else if (msg.type === "scheduler-log") {
        if (data) {
          if (!data.scheduler.logs) data.scheduler.logs = [];
          data.scheduler.logs.push(msg.data);
          if (data.scheduler.logs.length > 100) data.scheduler.logs.shift();
          if (currentTab === "logs") render();
        }
      }
    } catch(err) {}
  };
  es.onerror = function() {
    es.close();
    setTimeout(connectSSE, 3000);
  };
}

refresh();
connectSSE();
<\/script>
</body>
</html>`;
}

// ── HTTP Server ──────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  // GET / → HTML page
  if (path === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(buildHTML());
    return;
  }

  // GET /api/data → full data
  if (path === "/api/data" && req.method === "GET") {
    const result = buildData();
    result.scheduler.logs = scheduler.logs;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  // POST /api/scheduler/toggle
  if (path === "/api/scheduler/toggle" && req.method === "POST") {
    const enabled = scheduler.toggle();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ enabled }));
    return;
  }

  // GET /api/scheduler/logs
  if (path === "/api/scheduler/logs" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(scheduler.logs));
    return;
  }

  // GET /api/events → SSE
  if (path === "/api/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // POST /api/open-viewer → spawn report-viewer for a worktree
  if (path === "/api/open-viewer" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { worktree } = JSON.parse(body);
        const wtPath = join(WORKTREES_DIR, worktree);
        if (!existsSync(wtPath)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Worktree not found" }));
          return;
        }

        const wtDir = join(wtPath, ".worktree");
        // Determine chain type
        const hasReq = existsSync(join(wtDir, "REQ.md")) || existsSync(join(wtDir, "IMPL_REPORT.md"));
        const hasDefect = existsSync(join(wtDir, "DEFECT.md")) || existsSync(join(wtDir, "FIX_REPORT.md"));
        const script = hasDefect ? "serve-defect-chain.mjs" : "serve-req-chain.mjs";

        // Spawn viewer in the worktree context
        const child = spawn("node", [join(PROJECT_ROOT, "scripts", "admin", script)], {
          cwd: wtPath,
          stdio: "ignore",
          detached: true,
        });
        child.unref();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, script }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ── Start ────────────────────────────────────────────────────────────────

setupWatchers();

const port = parseInt(process.env.PORT || "0", 10);
server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const url = `http://localhost:${addr.port}`;
  console.log(`\n  Task Manager: ${url}\n`);

  // Auto-open in browser
  try {
    execSync(`open "${url}"`, { stdio: "ignore" });
  } catch {
    // Ignore if open fails (non-macOS)
  }
});
