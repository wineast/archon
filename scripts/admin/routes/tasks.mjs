/**
 * Tasks API routes — thin handlers delegating to services.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scanTasks, readTaskContent, moveTaskStatus } from "../services/task-scanner.mjs";
import { scanWorktrees } from "../services/worktree-scanner.mjs";
import { exec } from "../services/git-ops.mjs";
import { openTerminal } from "../services/command-runner.mjs";

export function createTasksRouter(dirs, broadcastSSE) {
  const { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR } = dirs;

  function buildData() {
    const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR);
    const worktrees = scanWorktrees(WORKTREES_DIR);

    for (const task of tasks) {
      task.chain = null;
      if (task.worktree) {
        const wt = worktrees.find((w) => w.name === task.worktree);
        if (wt) task.chain = wt.reqChain || wt.defectChain || null;
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

    // POST /api/tasks/dispatch — create worktree + run chain
    if (path === "/api/tasks/dispatch" && req.method === "POST") {
      readBody(req).then((body) => {
        try {
          const { type, id } = JSON.parse(body);
          const taskId = id;

          // 1. Create worktree
          try {
            const createResult = exec(
              `node scripts/worktree/worktree.mjs create ${taskId}`,
              PROJECT_ROOT,
              { timeout: 60000 }
            );
            console.log(`[dispatch] Worktree created for "${taskId}": ${createResult.split("\n").pop()}`);
          } catch (e) {
            json(res, 500, { error: `Failed to create worktree: ${e.message}` });
            return;
          }

          const wtPath = join(WORKTREES_DIR, taskId);
          if (!existsSync(wtPath)) {
            json(res, 500, { error: `Worktree path not found after creation: ${wtPath}` });
            return;
          }

          // 2. Write task.json + TASK.md
          const wtDir = join(wtPath, ".worktree");
          const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR);
          const task = tasks.find((t) => t.id === taskId && t.type === type);
          const taskJson = { type, id: taskId, path: task?.path || "" };

          try {
            writeFileSync(join(wtDir, "task.json"), JSON.stringify(taskJson, null, 2));
          } catch (e) {
            console.error(`[dispatch] Failed to write task.json: ${e.message}`);
          }

          try {
            const taskContent = readFileSync(join(PROJECT_ROOT, task?.path || ""), "utf-8");
            const taskBody = taskContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
            writeFileSync(join(wtDir, "TASK.md"), taskBody);
          } catch (e) {
            console.error(`[dispatch] Failed to write TASK.md: ${e.message}`);
          }

          // 3. Update frontmatter: status → running, worktree → taskId
          try {
            const baseDir = type === "todo" ? TODO_DIR : ISSUES_DIR;
            const filePath = join(baseDir, `${taskId}.md`);
            let content = readFileSync(filePath, "utf-8");
            content = content.replace(/^(---\r?\n[\s\S]*?\r?\n---)/, (match) => {
              let fm = match;
              if (/^status:/m.test(fm)) fm = fm.replace(/^status:.*/m, `status: running`);
              else fm = fm.replace(/\n---$/, `\nstatus: running\n---`);
              if (/^worktree:/m.test(fm)) fm = fm.replace(/^worktree:.*/m, `worktree: ${taskId}`);
              else fm = fm.replace(/\n---$/, `\nworktree: ${taskId}\n---`);
              return fm;
            });
            writeFileSync(filePath, content);
          } catch (e) {
            console.error(`[dispatch] Failed to update frontmatter: ${e.message}`);
          }

          // 4. Open terminal with chain skill
          const skill = type === "todo" ? "/req-chain" : "/defect-chain";
          try {
            openTerminal(wtPath, taskId, skill);
            broadcastSSE({ type: "refresh", section: "tasks" });
            json(res, 200, { ok: true });
          } catch (e) {
            // Rollback status on terminal failure
            try {
              moveTaskStatus(type, taskId, "ready", TODO_DIR, ISSUES_DIR);
            } catch {}
            json(res, 500, { error: `Failed to open terminal: ${e.message}` });
          }
        } catch (e) {
          json(res, 500, { error: e.message });
        }
      });
      return true;
    }

    // POST /api/tasks/complete — mark task as done/closed
    if (path === "/api/tasks/complete" && req.method === "POST") {
      readBody(req).then((body) => {
        try {
          const { type, id } = JSON.parse(body);
          const to = type === "todo" ? "done" : "closed";
          const result = moveTaskStatus(type, id, to, TODO_DIR, ISSUES_DIR);
          if (result.error) {
            const status = result.error.startsWith("Task not found") ? 404 : 400;
            json(res, status, result);
          } else {
            if (result.moved) broadcastSSE({ type: "refresh", section: "tasks" });
            json(res, 200, result);
          }
        } catch (e) {
          json(res, 500, { error: e.message });
        }
      });
      return true;
    }

    // POST /api/tasks/move-status
    if (path === "/api/tasks/move-status" && req.method === "POST") {
      readBody(req).then((body) => {
        try {
          const { type, id, to } = JSON.parse(body);
          const result = moveTaskStatus(type, id, to, TODO_DIR, ISSUES_DIR);
          if (result.error) {
            const status = result.error.startsWith("Task not found") ? 404 : 400;
            json(res, status, result);
          } else {
            if (result.moved) broadcastSSE({ type: "refresh", section: "tasks" });
            json(res, 200, result);
          }
        } catch (e) {
          json(res, 500, { error: e.message });
        }
      });
      return true;
    }

    // POST /api/tasks/open-terminal
    if (path === "/api/tasks/open-terminal" && req.method === "POST") {
      readBody(req).then((body) => {
        try {
          const { worktree, skill } = JSON.parse(body);
          const wtPath = join(WORKTREES_DIR, worktree);
          if (!existsSync(wtPath)) {
            json(res, 404, { error: `Worktree not found: ${worktree}` });
            return;
          }
          openTerminal(wtPath, worktree, skill || "");
          json(res, 200, { ok: true });
        } catch (e) {
          json(res, 500, { error: e.message });
        }
      });
      return true;
    }

    return false;
  };
}
