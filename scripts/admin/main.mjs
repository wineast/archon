#!/usr/bin/env node
/**
 * Archon Admin — Unified local management panel
 * Task-centric workflow view.
 *
 * Usage:
 *   node scripts/admin/main.mjs
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
const DIST_DIR = join(ADMIN_DIR, "dist");
const USE_DIST = existsSync(join(DIST_DIR, "index.html"));
const STATIC_DIR = USE_DIST ? DIST_DIR : ADMIN_DIR;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  let filePath;

  if (urlPath === "/") {
    filePath = join(STATIC_DIR, "index.html");
  } else {
    filePath = join(STATIC_DIR, urlPath);
  }

  // Security: prevent path traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    return false;
  }

  if (!existsSync(filePath)) {
    // SPA fallback: non-API, non-file requests return index.html
    if (USE_DIST && !urlPath.startsWith("/api") && !extname(urlPath)) {
      filePath = join(STATIC_DIR, "index.html");
    } else {
      return false;
    }
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
  // Watch todo/ and issues/ root directories for task changes
  let taskDebounce = null;
  const notifyTasks = () => {
    if (taskDebounce) return;
    taskDebounce = setTimeout(() => {
      taskDebounce = null;
      broadcastSSE({ type: "refresh", section: "tasks" });
    }, 500);
  };

  for (const dir of [TODO_DIR, ISSUES_DIR]) {
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
