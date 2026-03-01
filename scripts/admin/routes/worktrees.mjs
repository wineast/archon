/**
 * Worktrees API routes — thin handlers delegating to services.
 * Only keeps delete endpoint (branch management removed).
 */

import { sseShell } from "../services/command-runner.mjs";

export function createWorktreesRouter(dirs) {
  const { PROJECT_ROOT } = dirs;

  return function worktreesRouter(req, res, url) {
    const path = url.pathname;

    // POST /api/worktrees/delete
    if (path === "/api/worktrees/delete" && req.method === "POST") {
      const name = url.searchParams.get("name");
      if (!name) { res.writeHead(400); res.end("Missing name"); return true; }
      sseShell("make", [`wt-delete`, `NAME=${name}`], PROJECT_ROOT, res);
      return true;
    }

    return false;
  };
}
