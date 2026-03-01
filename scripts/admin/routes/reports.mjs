/**
 * Reports API routes — thin handlers delegating to services.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  listReportWorktrees,
  readReportData,
  readStatusData,
  readMergeCheck,
  serveAsset,
} from "../services/worktree-scanner.mjs";
import { exec, getBaseBranch, getFileDiff } from "../services/git-ops.mjs";
import { markTaskMerged } from "../services/task-scanner.mjs";
import { execSync } from "node:child_process";

export function createReportsRouter(dirs) {
  const { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR } = dirs;
  const mergeStates = new Map();

  function json(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  return function reportsRouter(req, res, url) {
    const path = url.pathname;

    // GET /api/reports/list
    if (path === "/api/reports/list" && req.method === "GET") {
      json(res, 200, listReportWorktrees(WORKTREES_DIR));
      return true;
    }

    // Match /api/reports/:wt/*
    const wtMatch = path.match(/^\/api\/reports\/([^/]+)\/(.+)$/);
    if (!wtMatch) return false;

    const wtName = decodeURIComponent(wtMatch[1]);
    const subPath = wtMatch[2];
    const wtPath = join(WORKTREES_DIR, wtName);
    const wtDir = join(wtPath, ".worktree");

    if (!existsSync(wtPath)) {
      json(res, 404, { error: "Worktree not found" });
      return true;
    }

    // GET /api/reports/:wt/data
    if (subPath === "data" && req.method === "GET") {
      const data = readReportData(wtName, WORKTREES_DIR);
      json(res, 200, data);
      return true;
    }

    // GET /api/reports/:wt/status
    if (subPath === "status" && req.method === "GET") {
      const data = readStatusData(wtName, WORKTREES_DIR, PROJECT_ROOT);
      json(res, 200, data);
      return true;
    }

    // GET /api/reports/:wt/merge-check
    if (subPath === "merge-check" && req.method === "GET") {
      const data = readMergeCheck(wtName, WORKTREES_DIR, PROJECT_ROOT, mergeStates);
      json(res, 200, data);
      return true;
    }

    // POST /api/reports/:wt/git-add
    if (subPath === "git-add" && req.method === "POST") {
      const result = exec("git add .", wtPath);
      json(res, 200, { ok: true });
      return true;
    }

    // POST /api/reports/:wt/sync
    if (subPath === "sync" && req.method === "POST") {
      const scriptPath = join(PROJECT_ROOT, "scripts", "worktree", "worktree.mjs");
      if (!existsSync(scriptPath)) {
        json(res, 400, { ok: false, error: "Cannot find worktree.mjs" });
        return true;
      }
      try {
        execSync(`node ${scriptPath} sync`, { cwd: wtPath, timeout: 30000, stdio: "pipe" });
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 500, { ok: false, error: e.stderr?.toString() || e.message });
      }
      return true;
    }

    // POST /api/reports/:wt/merge
    if (subPath === "merge" && req.method === "POST") {
      if (mergeStates.get(wtName) === "success") {
        json(res, 409, { ok: false, error: "Already merged" });
        return true;
      }

      const baseBranch = getBaseBranch(wtDir);
      try {
        const behind = exec(`git rev-list HEAD..${baseBranch} --count`, wtPath);
        if (behind !== "0") {
          json(res, 409, { ok: false, error: `落后上游 ${behind} 个 commit，请先同步` });
          return true;
        }
      } catch {}

      const scriptPath = join(PROJECT_ROOT, "scripts", "worktree", "worktree.mjs");
      if (!existsSync(scriptPath)) {
        json(res, 400, { ok: false, error: "Cannot find worktree.mjs" });
        return true;
      }

      try {
        execSync(`node ${scriptPath} merge ${wtName}`, { cwd: PROJECT_ROOT, timeout: 60000, stdio: "pipe" });
        mergeStates.set(wtName, "success");
        // Mark task as merged: merged: true + status → merged
        const taskResult = markTaskMerged(wtName, TODO_DIR, ISSUES_DIR);
        json(res, 200, { ok: true, task: taskResult });
      } catch (e) {
        mergeStates.set(wtName, "failed");
        json(res, 500, { ok: false, error: e.stderr?.toString() || e.message });
      }
      return true;
    }

    // GET /api/reports/:wt/file-diff?path=xxx&source=committed
    if (subPath === "file-diff" && req.method === "GET") {
      const filePath = url.searchParams.get("path");
      const source = url.searchParams.get("source") || "committed";
      if (!filePath) {
        json(res, 400, { error: "Missing path parameter" });
        return true;
      }
      const validSources = ["committed", "staged", "working", "untracked"];
      if (!validSources.includes(source)) {
        json(res, 400, { error: `Invalid source: ${source}` });
        return true;
      }
      const baseBranch = getBaseBranch(wtDir);
      const diff = getFileDiff(wtPath, baseBranch, filePath, source);
      json(res, 200, { diff, filePath });
      return true;
    }

    // GET /api/reports/:wt/assets/*
    if (subPath.startsWith("assets/") && req.method === "GET") {
      const relPath = decodeURIComponent(subPath.slice("assets/".length));
      serveAsset(wtDir, relPath, res);
      return true;
    }

    return false;
  };
}
