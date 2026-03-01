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
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createTasksRouter } from "./routes/tasks.mjs";
import { createWorktreesRouter } from "./routes/worktrees.mjs";
import { createReportsRouter } from "./routes/reports.mjs";
import { createTerminalManager } from "./services/terminal-manager.mjs";
import { createTransitionHooks } from "./services/transition-hooks.mjs";
import { scanTasks } from "./services/task-scanner.mjs";
import { exec } from "./services/git-ops.mjs";

// ── Constants ────────────────────────────────────────────────

const PROJECT_ROOT = execSync("git rev-parse --show-toplevel", {
  encoding: "utf-8",
}).trim();
const WORKTREES_DIR = join(PROJECT_ROOT, ".worktrees");
const TODO_DIR = join(PROJECT_ROOT, "todo");
const ISSUES_DIR = join(PROJECT_ROOT, "issues");

const dirs = { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR };

// ── Terminal Manager ─────────────────────────────────────────

const termManager = createTerminalManager();

// ── Transition Hooks ─────────────────────────────────────────

const hooks = createTransitionHooks();

// Post-hook: →ready — 创建工作区 + 写入 TASK.md
hooks.post({ to: "ready" }, async (ctx) => {
  const { type, id, dirs: d } = ctx;
  const { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR } = d;

  // 1. 创建工作区
  const result = exec(
    `node scripts/worktree/worktree.mjs create ${id}`,
    PROJECT_ROOT,
    { timeout: 60000 }
  );
  console.log(`[hook:running] Worktree created: ${result.split("\n").pop()}`);

  const wtPath = join(WORKTREES_DIR, id);
  if (!existsSync(wtPath)) {
    throw new Error(`Worktree not found: ${wtPath}`);
  }

  // 2. 写入 TASK.md（去掉 frontmatter）
  const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR);
  const task = tasks.find((t) => t.id === id && t.type === type);
  if (task) {
    const raw = readFileSync(join(PROJECT_ROOT, task.path), "utf-8");
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    writeFileSync(join(wtPath, ".worktree", "TASK.md"), body);
  }

  // 3. 回写 worktree 字段到任务 frontmatter
  const baseDir = type === "todo" ? TODO_DIR : ISSUES_DIR;
  const filePath = join(baseDir, `${id}.md`);
  let content = readFileSync(filePath, "utf-8");
  if (/^worktree:/m.test(content)) {
    content = content.replace(/^worktree:.*/m, `worktree: ${id}`);
  } else {
    content = content.replace(/\n---/, `\nworktree: ${id}\n---`);
  }
  writeFileSync(filePath, content);
});

// Post-hook: →running — 启动终端运行 chain
hooks.post({ to: "running" }, async (ctx) => {
  const { type, id, dirs: d } = ctx;
  const wtPath = join(d.WORKTREES_DIR, id);
  if (!existsSync(wtPath)) return;
  const skill = type === "todo" ? "/req-chain" : "/defect-chain";
  termManager.create(id, wtPath, `claude ${skill}`);
});

// ── Route modules ────────────────────────────────────────────

const tasksRouter = createTasksRouter(dirs, termManager, hooks);
const worktreesRouter = createWorktreesRouter(dirs);
const reportsRouter = createReportsRouter(dirs);

// ── HTTP Server ──────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

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

  res.writeHead(404);
  res.end("Not found");
});

// ── Start ────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || "4100", 10);
server.listen(port, "127.0.0.1", () => {
  console.log(`\n  Archon API: http://localhost:${server.address().port}\n`);
});
