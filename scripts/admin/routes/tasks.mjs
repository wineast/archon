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

// ── Terminal ─────────────────────────────────────────────────

function openTerminal(cwd, taskId, initialInput) {
  // Use osascript to open a new Terminal.app window
  // The script: cd to worktree, set title, run claude with skill
  const cmd = initialInput
    ? `cd ${JSON.stringify(cwd)} && claude ${initialInput}`
    : `cd ${JSON.stringify(cwd)} && claude`;
  const script = `
    tell application "Terminal"
      activate
      set newTab to do script ${JSON.stringify(cmd)}
      set custom title of front window to ${JSON.stringify("Claude: " + taskId)}
    end tell
  `;
  spawn("osascript", ["-e", script], { stdio: "ignore", detached: true }).unref();
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

    // Determine chain by task type; fallback to file-presence detection
    const taskType = taskRef?.type;
    let showReqChain = null;
    let showDefectChain = null;
    if (taskType === "todo") {
      showReqChain = reqChain;
    } else if (taskType === "issue") {
      showDefectChain = defectChain;
    } else {
      // No task.json or unknown type — show whichever has files
      if (Object.values(reqChain).some(Boolean)) showReqChain = reqChain;
      if (Object.values(defectChain).some(Boolean)) showDefectChain = defectChain;
    }

    // Read persisted remote URL
    let remoteUrl = "";
    const remotePath = join(wtDir, "remote.json");
    if (existsSync(remotePath)) {
      try {
        const rd = JSON.parse(readFileSync(remotePath, "utf-8"));
        remoteUrl = rd.url || "";
      } catch {}
    }

    result.push({
      name,
      path: wtPath,
      taskRef,
      meta,
      remoteUrl,
      reqChain: showReqChain,
      defectChain: showDefectChain,
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
      const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR).filter((t) => t.status === "ready");
      if (!tasks.length) return;

      // Limit concurrent dispatches
      const runningCount = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR).filter((t) => t.status === "running").length;
      if (runningCount >= this.maxConcurrent) {
        this.log("debug", `At capacity (${runningCount}/${this.maxConcurrent}), skipping`);
        return;
      }

      tasks.sort((a, b) => a.priority.localeCompare(b.priority));
      const slots = this.maxConcurrent - runningCount;
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
          `node scripts/worktree/worktree.mjs create ${taskId}`,
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

      // Write TASK.md (task body without frontmatter) for chain skills
      try {
        const taskContent = readFileSync(join(PROJECT_ROOT, task.path), "utf-8");
        const taskBody = taskContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
        writeFileSync(join(wtDir, "TASK.md"), taskBody);
      } catch (e) {
        this.log("error", `Failed to write TASK.md: ${e.message}`);
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
        // Move file to running folder
        const baseDir = task.type === "todo" ? TODO_DIR : ISSUES_DIR;
        const runningDir = join(baseDir, "running");
        mkdirSync(runningDir, { recursive: true });
        const destPath = join(runningDir, `${taskId}.md`);
        if (taskFilePath !== destPath) {
          renameSync(taskFilePath, destPath);
        }
      } catch (e) {
        this.log("error", `Failed to update task frontmatter: ${e.message}`);
      }

      // Open a terminal window with claude in the worktree
      const skill = task.type === "todo" ? "/req-chain" : "/defect-chain";
      this.log("info", `Opening terminal for "${taskId}" in ${wtPath}`);

      try {
        openTerminal(wtPath, taskId, skill);
        this.log("info", `Terminal opened for "${taskId}"`);
        broadcastSSE({ type: "refresh", section: "tasks" });
      } catch (e) {
        this.log("error", `Failed to open terminal for "${taskId}": ${e.message}`);
        this.rollbackStatus(task);
      }
    },

    rollbackStatus(task) {
      // Move back to ready folder and update frontmatter
      const baseDir = task.type === "todo" ? TODO_DIR : ISSUES_DIR;
      const runningPath = join(baseDir, "running", `${task.id}.md`);
      const readyPath = join(baseDir, "ready", `${task.id}.md`);
      const filePath = existsSync(runningPath) ? runningPath : join(PROJECT_ROOT, task.path);
      try {
        let content = readFileSync(filePath, "utf-8");
        content = content.replace(/^status:.*/m, "status: ready");
        writeFileSync(filePath, content);
        if (filePath !== readyPath) {
          mkdirSync(join(baseDir, "ready"), { recursive: true });
          renameSync(filePath, readyPath);
        }
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
      if (task.worktree) {
        const wt = worktrees.find((w) => w.name === task.worktree);
        if (wt) {
          task.chain = wt.reqChain || wt.defectChain || null;
        }
      }
    }

    return {
      tasks,
      worktrees,
      scheduler: {
        enabled: scheduler.enabled,
        maxConcurrent: scheduler.maxConcurrent,
        runningCount: tasks.filter((t) => t.status === "running").length,
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

    // Task detail content
    const detailMatch = path.match(/^\/api\/tasks\/detail\/(.+)$/);
    if (detailMatch && req.method === "GET") {
      const taskPath = decodeURIComponent(detailMatch[1]);
      const fullPath = join(PROJECT_ROOT, taskPath);
      if (!fullPath.startsWith(PROJECT_ROOT) || !existsSync(fullPath)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return true;
      }
      const content = readFileSync(fullPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
      return true;
    }

    if (path === "/api/tasks/scheduler/toggle" && req.method === "POST") {
      const enabled = scheduler.toggle();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ enabled }));
      return true;
    }

    if (path === "/api/tasks/scheduler/config" && req.method === "GET") {
      const runningTasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR).filter((t) => t.status === "running");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        enabled: scheduler.enabled,
        maxConcurrent: scheduler.maxConcurrent,
        scanInterval: scheduler.scanInterval,
        runningCount: runningTasks.length,
        runningTasks: runningTasks.map((t) => ({
          id: t.id,
          type: t.type,
          worktree: t.worktree,
        })),
      }));
      return true;
    }

    if (path === "/api/tasks/scheduler/config" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const cfg = JSON.parse(body);
          if (typeof cfg.maxConcurrent === "number" && cfg.maxConcurrent >= 1 && cfg.maxConcurrent <= 20) {
            scheduler.maxConcurrent = cfg.maxConcurrent;
          }
          if (typeof cfg.scanInterval === "number" && cfg.scanInterval >= 5000 && cfg.scanInterval <= 300000) {
            const wasRunning = scheduler.enabled;
            if (wasRunning) scheduler.stop();
            scheduler.scanInterval = cfg.scanInterval;
            if (wasRunning) scheduler.start();
          }
          scheduler.log("info", `Config updated: maxConcurrent=${scheduler.maxConcurrent}, scanInterval=${scheduler.scanInterval}ms`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, maxConcurrent: scheduler.maxConcurrent, scanInterval: scheduler.scanInterval }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
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

    // Open terminal for a task's worktree
    if (path === "/api/tasks/open-terminal" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { worktree, skill } = JSON.parse(body);
          const wtPath = join(WORKTREES_DIR, worktree);
          if (!existsSync(wtPath)) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Worktree not found: ${worktree}` }));
            return;
          }
          openTerminal(wtPath, worktree, skill || "");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
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
