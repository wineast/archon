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
import { exec, getBaseBranch } from "../services/git-ops.mjs";
import { sseExec } from "../services/command-runner.mjs";

export function createReportsRouter(dirs) {
  const { PROJECT_ROOT, WORKTREES_DIR } = dirs;
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
      const data = readMergeCheck(wtName, WORKTREES_DIR, mergeStates);
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
      const scriptPath = join(PROJECT_ROOT, "scripts", "worktree.mjs");
      if (!existsSync(scriptPath)) {
        res.writeHead(400);
        res.end("Cannot find worktree.mjs");
        return true;
      }
      sseExec("node", [scriptPath, "sync"], { cwd: wtPath }, res);
      return true;
    }

    // POST /api/reports/:wt/merge
    if (subPath === "merge" && req.method === "POST") {
      if (mergeStates.get(wtName) === "running") {
        res.writeHead(409);
        res.end("Merge already running");
        return true;
      }
      if (mergeStates.get(wtName) === "success") {
        res.writeHead(409);
        res.end("Already merged");
        return true;
      }

      const baseBranch = getBaseBranch(wtDir);
      try {
        const behind = exec(`git rev-list HEAD..${baseBranch} --count`, wtPath);
        if (behind !== "0") {
          res.writeHead(409);
          res.end(`Cannot merge: behind upstream by ${behind} commit(s). Sync first.`);
          return true;
        }
      } catch {}

      const scriptPath = join(PROJECT_ROOT, "scripts", "worktree.mjs");
      if (!existsSync(scriptPath)) {
        res.writeHead(400);
        res.end("Cannot determine merge parameters");
        return true;
      }

      mergeStates.set(wtName, "running");
      const child = sseExec("node", [scriptPath, "merge", wtName], { cwd: PROJECT_ROOT }, res);
      child.on("close", (code) => {
        mergeStates.set(wtName, code === 0 ? "success" : "failed");
      });
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
