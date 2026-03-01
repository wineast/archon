/**
 * Tasks API routes — thin handlers delegating to services.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { scanTasks, readTaskContent, getTaskStatus, moveTaskStatus } from "../services/task-scanner.mjs";
import { scanWorktrees } from "../services/worktree-scanner.mjs";

export function createTasksRouter(dirs, termManager, hooks) {
  const { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR } = dirs;

  function buildData() {
    const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR);
    const worktrees = scanWorktrees(WORKTREES_DIR);

    for (const task of tasks) {
      task.chain = null;
      task.hasTerminal = false;
      if (task.worktree) {
        const wt = worktrees.find((w) => w.name === task.worktree);
        if (wt) {
          task.chain = wt.reqChain || wt.defectChain || null;
          task.hasTerminal = termManager.has(task.worktree);
        }
      }
    }

    return {
      tasks,
      worktrees,
      stats: {
        total: tasks.length,
        ready: tasks.filter((t) => t.status === "ready").length,
        running: tasks.filter((t) => t.status === "running").length,
        completed: tasks.filter((t) => ["done", "closed", "cancelled", "wontfix"].includes(t.status)).length,
        todoCount: tasks.filter((t) => t.type === "todo").length,
        issueCount: tasks.filter((t) => t.type === "issue").length,
      },
    };
  }

  function json(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => resolve(body));
    });
  }

  return function tasksRouter(req, res, url) {
    const path = url.pathname;

    // GET /api/tasks/data
    if (path === "/api/tasks/data" && req.method === "GET") {
      json(res, 200, buildData());
      return true;
    }

    // GET /api/tasks/detail/:path
    const detailMatch = path.match(/^\/api\/tasks\/detail\/(.+)$/);
    if (detailMatch && req.method === "GET") {
      const taskPath = decodeURIComponent(detailMatch[1]);
      const content = readTaskContent(PROJECT_ROOT, taskPath);
      if (content === null) {
        json(res, 404, { error: "Not found" });
      } else {
        json(res, 200, { content });
      }
      return true;
    }

    // POST /api/tasks/move-status — unified status transition with hooks
    if (path === "/api/tasks/move-status" && req.method === "POST") {
      readBody(req).then(async (body) => {
        try {
          const { type, id, to } = JSON.parse(body);

          // Read current status for hook context
          const from = getTaskStatus(type, id, TODO_DIR, ISSUES_DIR);
          if (from === null) {
            json(res, 404, { error: `Task not found: ${id}` });
            return;
          }
          if (from === to) {
            json(res, 200, { ok: true, moved: false });
            return;
          }

          // Status mutation
          const result = moveTaskStatus(type, id, to, TODO_DIR, ISSUES_DIR);
          if (result.error) {
            const status = result.error.startsWith("Task not found") ? 404 : 400;
            json(res, status, result);
            return;
          }

          // Post-hooks
          if (result.moved) {
            await hooks.run({ type, id, from, to, dirs });
          }

          json(res, 200, result);
        } catch (e) {
          json(res, 500, { error: e.message });
        }
      });
      return true;
    }

    // POST /api/tasks/open-terminal — open or activate Terminal.app window
    if (path === "/api/tasks/open-terminal" && req.method === "POST") {
      readBody(req).then((body) => {
        try {
          const { worktree, skill } = JSON.parse(body);
          const wtPath = join(WORKTREES_DIR, worktree);
          if (!existsSync(wtPath)) {
            json(res, 404, { error: `Worktree not found: ${worktree}` });
            return;
          }
          // Try to activate existing window first
          if (termManager.has(worktree) && termManager.activate(worktree)) {
            json(res, 200, { ok: true, activated: true });
            return;
          }
          // Open new terminal
          const initialCommand = skill ? `claude ${skill}` : undefined;
          termManager.create(worktree, wtPath, initialCommand);
          json(res, 200, { ok: true, activated: false });
        } catch (e) {
          json(res, 500, { error: e.message });
        }
      });
      return true;
    }

    // GET /api/tasks/terminal/:sessionId — verify terminal window still alive
    const termMatch = path.match(/^\/api\/tasks\/terminal\/(.+)$/);
    if (termMatch && req.method === "GET") {
      const sessionId = decodeURIComponent(termMatch[1]);
      const exists = termManager.verify(sessionId);
      json(res, 200, { exists, sessionId });
      return true;
    }

    return false;
  };
}
