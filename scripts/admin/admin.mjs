#!/usr/bin/env node
/**
 * Archon Admin — Unified local management panel
 * Combines Tasks, Worktrees, and Reports into a single UI.
 * Zero external dependencies. Alpine.js + marked via CDN.
 *
 * Usage:
 *   node scripts/admin/admin.mjs
 *   make admin
 */

import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, watch } from "node:fs";
import { join, extname } from "node:path";

import { createTasksRouter } from "./routes/tasks.mjs";
import { createWorktreesRouter } from "./routes/worktrees.mjs";
import { createReportsRouter } from "./routes/reports.mjs";

// ── Constants ────────────────────────────────────────────────

const PROJECT_ROOT = execSync("git rev-parse --show-toplevel", {
  encoding: "utf-8",
}).trim();
const WORKTREES_DIR = join(PROJECT_ROOT, ".worktrees");
const TODO_DIR = join(PROJECT_ROOT, "todo");
const ISSUES_DIR = join(PROJECT_ROOT, "issues");

const dirs = { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR };

// ── SSE ──────────────────────────────────────────────────────

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

// ── Route modules ────────────────────────────────────────────

const tasksRouter = createTasksRouter(dirs, broadcastSSE);
const worktreesRouter = createWorktreesRouter(dirs);
const reportsRouter = createReportsRouter(dirs);

// ── Static file serving ──────────────────────────────────────

const ADMIN_DIR = new URL(".", import.meta.url).pathname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function serveStatic(req, res) {
  let filePath;
  const urlPath = new URL(req.url, "http://localhost").pathname;

  if (urlPath === "/") {
    filePath = join(ADMIN_DIR, "index.html");
  } else {
    // Map URL to file path within admin/
    filePath = join(ADMIN_DIR, urlPath);
  }

  // Security: prevent path traversal
  if (!filePath.startsWith(ADMIN_DIR)) {
    return false;
  }

  if (!existsSync(filePath)) {
    return false;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

// ── File watchers ────────────────────────────────────────────

function setupWatchers() {
  // Watch todo/issues for task changes
  const taskDirs = [
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

  let taskDebounce = null;
  const notifyTasks = () => {
    if (taskDebounce) return;
    taskDebounce = setTimeout(() => {
      taskDebounce = null;
      broadcastSSE({ type: "refresh", section: "tasks" });
    }, 500);
  };

  for (const dir of taskDirs) {
    if (!existsSync(dir)) continue;
    try {
      watch(dir, { persistent: false }, notifyTasks);
    } catch {}
  }

  // Watch worktrees for report changes
  if (existsSync(WORKTREES_DIR)) {
    let wtDebounce = null;
    try {
      watch(WORKTREES_DIR, { recursive: true, persistent: false }, (_, filename) => {
        if (!filename) return;
        if (wtDebounce) return;
        wtDebounce = setTimeout(() => {
          wtDebounce = null;
          if (filename.endsWith(".md") || filename.endsWith(".json")) {
            broadcastSSE({ type: "refresh", section: "reports" });
            broadcastSSE({ type: "refresh", section: "tasks" });
          }
        }, 500);
      });
    } catch {}
  }
}

// ── HTTP Server ──────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  // SSE endpoint
  if (path === "/api/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // API routes
  if (path.startsWith("/api/tasks/")) {
    if (tasksRouter(req, res, url)) return;
  }
  if (path.startsWith("/api/worktrees/")) {
    if (worktreesRouter(req, res, url)) return;
  }
  if (path.startsWith("/api/reports/")) {
    if (reportsRouter(req, res, url)) return;
  }

  // Static files
  if (req.method === "GET" && serveStatic(req, res)) return;

  res.writeHead(404);
  res.end("Not found");
});

// ── Start ────────────────────────────────────────────────────

setupWatchers();

const port = parseInt(process.env.PORT || "0", 10);
server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const url = `http://localhost:${addr.port}`;
  console.log(`\n  Archon Admin: ${url}\n`);

  // Auto-open in browser
  try {
    execSync(`open "${url}"`, { stdio: "ignore" });
  } catch {
    // Ignore if open fails (non-macOS)
  }
});
