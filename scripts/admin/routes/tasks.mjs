/**
 * Tasks API routes — extracted from task-manager.mjs
 */

import { execSync, spawn } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { join, relative } from "node:path";

// ── Helpers ──────────────────────────────────────────────────

function exec(cmd, cwd, opts = {}) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 15000,
      ...opts,
    }).trim();
  } catch {
    return "";
  }
}

function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kv) {
      let val = kv[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      fm[kv[1]] = val;
    }
  }
  return fm;
}

function parseTitle(content) {
  const m = content.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : "(untitled)";
}

// ── Data Layer ───────────────────────────────────────────────

function scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR) {
  const tasks = [];

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

function scanWorktrees(WORKTREES_DIR) {
  if (!existsSync(WORKTREES_DIR)) return [];
  const result = [];

  for (const name of readdirSync(WORKTREES_DIR)) {
    const wtPath = join(WORKTREES_DIR, name);
    const wtDir = join(wtPath, ".worktree");
    if (!existsSync(wtDir)) continue;

    let taskRef = null;
    const taskJsonPath = join(wtDir, "task.json");
    if (existsSync(taskJsonPath)) {
      try {
        taskRef = JSON.parse(readFileSync(taskJsonPath, "utf-8"));
      } catch {}
    }

    let meta = {};
    const metaPath = join(wtDir, "meta.json");
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {}
    }

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

// ── Scheduler ────────────────────────────────────────────────

const LOG_MAX = 100;

function createScheduler(dirs, broadcastSSE) {
  const { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR } = dirs;

  const scheduler = {
    enabled: false,
    maxConcurrent: 5,
    scanInterval: 30000,
    timer: null,
    running: new Map(),
    logs: [],

    log(level, msg) {
      const entry = { time: new Date().toISOString(), level, msg };
      this.logs.push(entry);
      if (this.logs.length > LOG_MAX) this.logs.shift();
      console.log(`[scheduler][${level}] ${msg}`);
      broadcastSSE({ type: "scheduler-log", section: "tasks", data: entry });
    },

    start() {
      if (this.enabled) return;
      this.enabled = true;
      this.log("info", "Scheduler started");
      this.tick();
      this.timer = setInterval(() => this.tick(), this.scanInterval);
      broadcastSSE({ type: "scheduler-state", section: "tasks", data: { enabled: true } });
    },

    stop() {
      if (!this.enabled) return;
      this.enabled = false;
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.log("info", "Scheduler stopped");
      broadcastSSE({ type: "scheduler-state", section: "tasks", data: { enabled: false } });
    },

    toggle() {
      if (this.enabled) this.stop();
      else this.start();
      return this.enabled;
    },

    tick() {
      for (const [taskId, info] of this.running) {
        if (info.process && info.process.exitCode !== null) {
          this.log("info", `Task "${taskId}" process exited (code ${info.process.exitCode})`);
          this.running.delete(taskId);
          broadcastSSE({ type: "refresh", section: "tasks" });
        }
      }

      if (this.running.size >= this.maxConcurrent) {
        this.log("debug", `At capacity (${this.running.size}/${this.maxConcurrent}), skipping`);
        return;
      }

      const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR).filter((t) => t.status === "ready");
      if (!tasks.length) return;

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

      try {
        const createResult = exec(
          `node scripts/worktree.mjs create ${taskId}`,
          PROJECT_ROOT,
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

      const wtDir = join(wtPath, ".worktree");
      const taskJson = { type: task.type, id: taskId, path: task.path };
      try {
        writeFileSync(join(wtDir, "task.json"), JSON.stringify(taskJson, null, 2));
      } catch (e) {
        this.log("error", `Failed to write task.json: ${e.message}`);
      }

      const taskFilePath = join(PROJECT_ROOT, task.path);
      try {
        let content = readFileSync(taskFilePath, "utf-8");
        content = content.replace(/^(---\r?\n[\s\S]*?\r?\n---)/, (match) => {
          let fm = match;
          if (/^status:/m.test(fm)) fm = fm.replace(/^status:.*/m, `status: running`);
          else fm = fm.replace(/\n---$/, `\nstatus: running\n---`);
          if (/^worktree:/m.test(fm)) fm = fm.replace(/^worktree:.*/m, `worktree: ${taskId}`);
          else fm = fm.replace(/\n---$/, `\nworktree: ${taskId}\n---`);
          return fm;
        });
        writeFileSync(taskFilePath, content);
      } catch (e) {
        this.log("error", `Failed to update task frontmatter: ${e.message}`);
      }

      const skill = task.type === "todo" ? "/requirement" : "/diagnose";
      this.log("info", `Spawning claude ${skill} in ${wtPath}`);

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
          const urlMatch = text.match(/https?:\/\/[^\s]+/);
          if (urlMatch && !info.remoteUrl) {
            info.remoteUrl = urlMatch[0];
            this.log("info", `Remote URL for "${taskId}": ${info.remoteUrl}`);
            broadcastSSE({ type: "refresh", section: "tasks" });
          }
        });

        child.on("error", (err) => {
          this.log("error", `Process error for "${taskId}": ${err.message}`);
          this.rollbackStatus(task);
          this.running.delete(taskId);
          broadcastSSE({ type: "refresh", section: "tasks" });
        });

        child.on("close", (code) => {
          this.log("info", `Task "${taskId}" completed (exit ${code})`);
          this.running.delete(taskId);
          broadcastSSE({ type: "refresh", section: "tasks" });
        });

        broadcastSSE({ type: "refresh", section: "tasks" });
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

  return scheduler;
}

// ── Router ───────────────────────────────────────────────────

export function createTasksRouter(dirs, broadcastSSE) {
  const { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR } = dirs;
  const scheduler = createScheduler(dirs, broadcastSSE);

  function buildData() {
    const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR);
    const worktrees = scanWorktrees(WORKTREES_DIR);

    for (const task of tasks) {
      task.chain = null;
      task.remoteUrl = "";
      if (task.worktree) {
        const wt = worktrees.find((w) => w.name === task.worktree);
        if (wt) {
          task.chain = wt.reqChain || wt.defectChain || null;
          const running = scheduler.running.get(task.id);
          if (running?.remoteUrl) task.remoteUrl = running.remoteUrl;
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
        logs: scheduler.logs,
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

  return function tasksRouter(req, res, url) {
    const path = url.pathname;

    if (path === "/api/tasks/data" && req.method === "GET") {
      const result = buildData();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    }

    if (path === "/api/tasks/scheduler/toggle" && req.method === "POST") {
      const enabled = scheduler.toggle();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ enabled }));
      return true;
    }

    if (path === "/api/tasks/scheduler/logs" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(scheduler.logs));
      return true;
    }

    // Move task to a different status folder
    if (path === "/api/tasks/move-status" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { type, id, to } = JSON.parse(body);
          const validTodo = ["pending", "ready", "running", "backlog", "done"];
          const validIssue = ["open", "ready", "running", "closed"];
          const allowed = type === "todo" ? validTodo : validIssue;
          if (!allowed.includes(to)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Invalid target status: ${to}` }));
            return;
          }
          const baseDir = type === "todo" ? TODO_DIR : ISSUES_DIR;
          // Find the file in any folder
          const folders = type === "todo" ? validTodo : validIssue;
          let srcPath = null;
          let srcFolder = null;
          for (const f of folders) {
            const p = join(baseDir, f, `${id}.md`);
            if (existsSync(p)) { srcPath = p; srcFolder = f; break; }
          }
          if (!srcPath) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Task not found: ${id}` }));
            return;
          }
          if (srcFolder === to) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, moved: false }));
            return;
          }
          // Update frontmatter status field
          let content = readFileSync(srcPath, "utf-8");
          const hasFm = /^---\r?\n[\s\S]*?\r?\n---/.test(content);
          if (hasFm) {
            if (/^status:/m.test(content)) {
              content = content.replace(/^(status:).*/m, `$1 ${to}`);
            } else {
              content = content.replace(/\n---/, `\nstatus: ${to}\n---`);
            }
          } else {
            content = `---\nstatus: ${to}\n---\n${content}`;
          }
          writeFileSync(srcPath, content);
          // Move file to target folder
          const destDir = join(baseDir, to);
          mkdirSync(destDir, { recursive: true });
          const destPath = join(destDir, `${id}.md`);
          renameSync(srcPath, destPath);
          broadcastSSE({ type: "refresh", section: "tasks" });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, moved: true, from: srcFolder, to }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return true;
    }

    return false;
  };
}
