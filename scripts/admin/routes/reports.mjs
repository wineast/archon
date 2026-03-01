/**
 * Reports API routes — extracted from report-viewer.mjs
 * Serves reports for ALL worktrees (multi-worktree mode).
 */

import { execSync, spawn } from "node:child_process";
import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  createReadStream,
} from "node:fs";
import { join, extname, resolve } from "node:path";

// ── Chain configs (from serve-req-chain.mjs / serve-defect-chain.mjs) ────

const REQ_CHAIN = {
  reports: [
    { key: "req", path: "REQ.md", label: "\u9700\u6C42\u62A5\u544A", badge: "req", optional: true },
    { key: "impl", path: "IMPL_REPORT.md", label: "\u5B9E\u73B0\u62A5\u544A", badge: "impl", optional: true },
    { key: "accept", path: "ACCEPT_REPORT.md", label: "\u9A8C\u6536\u62A5\u544A", badge: "accept", optional: true },
    { key: "guard", path: "CAP_GUARD.md", label: "\u5B88\u62A4\u89C4\u7EA6", badge: "guard", optional: true },
    { key: "report", path: "CAP_GUARD_REPORT.md", label: "\u5B88\u62A4\u62A5\u544A", badge: "report", optional: true },
  ],
  chain: [
    { key: "req", label: "\u9700\u6C42\u62A5\u544A", cssClass: "req" },
    { key: "impl", label: "\u5B9E\u73B0\u62A5\u544A", cssClass: "impl" },
    { key: "accept", label: "\u9A8C\u6536\u62A5\u544A", cssClass: "accept" },
    { key: "guard", label: "\u5B88\u62A4\u89C4\u7EA6", cssClass: "guard", optional: true },
    { key: "report", label: "\u5B88\u62A4\u62A5\u544A", cssClass: "report", optional: true },
  ],
  verdictSource: "accept",
};

const DEFECT_CHAIN = {
  reports: [
    { key: "defect", path: "DEFECT.md", label: "\u7F3A\u9677\u62A5\u544A", badge: "defect", optional: true },
    { key: "fix", path: "FIX_REPORT.md", label: "\u4FEE\u590D\u62A5\u544A", badge: "fix", optional: true },
    { key: "verify", path: "VERIFY_REPORT.md", label: "\u9A8C\u8BC1\u62A5\u544A", badge: "verify", optional: true },
    { key: "guard", path: "TEST_SPEC.md", label: "\u5B88\u62A4\u89C4\u7EA6", badge: "guard", optional: true },
    { key: "report", path: "TEST_SPEC_REPORT.md", label: "\u5B88\u62A4\u62A5\u544A", badge: "report", optional: true },
  ],
  chain: [
    { key: "defect", label: "\u7F3A\u9677\u62A5\u544A", cssClass: "defect" },
    { key: "fix", label: "\u4FEE\u590D\u62A5\u544A", cssClass: "fix" },
    { key: "verify", label: "\u9A8C\u8BC1\u62A5\u544A", cssClass: "verify" },
    { key: "guard", label: "\u5B88\u62A4\u89C4\u7EA6", cssClass: "guard", optional: true },
    { key: "report", label: "\u5B88\u62A4\u62A5\u544A", cssClass: "report", optional: true },
  ],
  verdictSource: "verify",
};

// ── Helpers ──────────────────────────────────────────────────

function exec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", timeout: 15000 }).trim();
  } catch {
    return "";
  }
}

function rd(p) {
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function sseExec(command, args, options, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line) send("stdout", line);
    }
  });

  child.stderr.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line) send("stderr", line);
    }
  });

  child.on("close", (code) => {
    send("exit", code);
    res.end();
  });

  child.on("error", (err) => {
    send("error", err.message);
    res.end();
  });

  res.on("close", () => {
    child.kill();
  });

  return child;
}

// ── Detect chain type for a worktree ─────────────────────────

function detectChain(wtDir) {
  const hasReq =
    existsSync(join(wtDir, "REQ.md")) ||
    existsSync(join(wtDir, "IMPL_REPORT.md")) ||
    existsSync(join(wtDir, "ACCEPT_REPORT.md"));
  const hasDefect =
    existsSync(join(wtDir, "DEFECT.md")) ||
    existsSync(join(wtDir, "FIX_REPORT.md")) ||
    existsSync(join(wtDir, "VERIFY_REPORT.md"));

  if (hasDefect) return "defect";
  if (hasReq) return "req";
  return null;
}

function getChainConfig(type) {
  return type === "defect" ? DEFECT_CHAIN : REQ_CHAIN;
}

// ── Parse git status ─────────────────────────────────────────

function parseGitStatus(cwd) {
  const raw = exec("git status --short", cwd);
  if (!raw) return { staged: 0, unstaged: 0, untracked: 0 };
  let staged = 0, unstaged = 0, untracked = 0;
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const x = line[0];
    const y = line[1];
    if (x === "?" && y === "?") { untracked++; continue; }
    if (x !== " " && x !== "?") staged++;
    if (y !== " " && y !== "?") unstaged++;
  }
  return { staged, unstaged, untracked };
}

// ── Router ───────────────────────────────────────────────────

export function createReportsRouter(dirs) {
  const { PROJECT_ROOT, WORKTREES_DIR } = dirs;

  // Per-worktree merge state tracking
  const mergeStates = new Map(); // wtName -> 'idle' | 'running' | 'success' | 'failed'

  return function reportsRouter(req, res, url) {
    const path = url.pathname;

    // GET /api/reports/list
    if (path === "/api/reports/list" && req.method === "GET") {
      const result = [];
      if (existsSync(WORKTREES_DIR)) {
        for (const name of readdirSync(WORKTREES_DIR)) {
          const wtDir = join(WORKTREES_DIR, name, ".worktree");
          if (!existsSync(wtDir)) continue;
          const chainType = detectChain(wtDir);
          if (!chainType) continue;
          result.push({ name, chainType });
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
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
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Worktree not found" }));
      return true;
    }

    // GET /api/reports/:wt/data
    if (subPath === "data" && req.method === "GET") {
      const chainType = detectChain(wtDir);
      const config = getChainConfig(chainType);

      // Read reports
      const reports = {};
      for (const r of config.reports) {
        reports[r.key] = rd(join(wtDir, r.path));
      }

      // Build chain status
      const chain = config.chain.map((c) => {
        const rpt = config.reports.find((r) => r.key === c.key);
        const available = rpt ? existsSync(join(wtDir, rpt.path)) : false;
        return { ...c, available };
      });

      // Branch info
      let branch = "";
      let baseBranch = "dev";
      try {
        branch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: wtPath, encoding: "utf-8",
        }).trim();
      } catch {}

      const metaPath = join(wtDir, "meta.json");
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(rd(metaPath));
          if (meta.baseBranch) baseBranch = meta.baseBranch;
        } catch {}
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        worktree: wtName,
        chainType,
        chain,
        reports,
        verdictSource: config.verdictSource,
        branch,
        baseBranch,
      }));
      return true;
    }

    // GET /api/reports/:wt/status
    if (subPath === "status" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });

      let baseBranch = "dev";
      const metaPath = join(wtDir, "meta.json");
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(rd(metaPath));
          if (meta.baseBranch) baseBranch = meta.baseBranch;
        } catch {}
      }

      let currentBranch = "";
      try {
        currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: wtPath, encoding: "utf-8",
        }).trim();
      } catch {}

      // Find upstream path
      let upstreamPath = PROJECT_ROOT;
      try {
        const raw = execSync("git worktree list --porcelain", {
          cwd: wtPath, encoding: "utf-8",
        });
        for (const entry of raw.split("\n\n").filter(Boolean)) {
          const lines = entry.split("\n");
          const pl = lines.find((l) => l.startsWith("worktree "));
          const bl = lines.find((l) => l.startsWith("branch "));
          if (pl && bl) {
            const sb = bl.replace("branch ", "").replace("refs/heads/", "");
            if (sb === baseBranch) {
              upstreamPath = pl.replace("worktree ", "");
              break;
            }
          }
        }
      } catch {}

      const result = { current: {}, upstream: {} };
      try {
        const curStatus = parseGitStatus(wtPath);
        const ahead = exec(`git rev-list ${baseBranch}..HEAD --count`, wtPath);
        const behind = exec(`git rev-list HEAD..${baseBranch} --count`, wtPath);
        result.current = {
          branch: currentBranch,
          ...curStatus,
          ahead: parseInt(ahead) || 0,
          behind: parseInt(behind) || 0,
        };

        const upStatus = parseGitStatus(upstreamPath);
        result.upstream = { branch: baseBranch, path: upstreamPath, ...upStatus };

        // Commits
        try {
          const logRaw = exec(
            `git log ${baseBranch}..HEAD --pretty=format:"%h|%s|%an|%ar" --no-merges`,
            wtPath
          );
          result.commits = logRaw
            ? logRaw.split("\n").map((line) => {
                const [hash, subject, author, date] = line.split("|");
                return { hash, subject, author, date };
              })
            : [];
        } catch { result.commits = []; }

        try {
          result.diffStat = exec(`git diff ${baseBranch}..HEAD --stat --stat-width=60`, wtPath);
        } catch { result.diffStat = ""; }
      } catch (e) {
        result.error = e.message;
      }

      res.end(JSON.stringify(result));
      return true;
    }

    // GET /api/reports/:wt/merge-check
    if (subPath === "merge-check" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });

      if (mergeStates.get(wtName) === "success") {
        res.end(JSON.stringify({ status: "merged", message: "\u5DF2\u5408\u5E76" }));
        return true;
      }

      let baseBranch = "dev";
      const metaPath = join(wtDir, "meta.json");
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(rd(metaPath));
          if (meta.baseBranch) baseBranch = meta.baseBranch;
        } catch {}
      }

      let currentBranch = "";
      try {
        currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: wtPath, encoding: "utf-8",
        }).trim();
      } catch {}

      if (!baseBranch || !currentBranch) {
        res.end(JSON.stringify({ status: "unknown", message: "Cannot determine branches" }));
        return true;
      }

      try {
        const behind = exec(`git rev-list HEAD..${baseBranch} --count`, wtPath);
        if (behind !== "0") {
          res.end(JSON.stringify({
            status: "behind",
            behind: parseInt(behind),
            message: `\u843D\u540E\u4E0A\u6E38 ${behind} \u4E2A commit`,
          }));
          return true;
        }

        const diffCheck = exec(
          `git diff ${baseBranch}..HEAD --quiet 2>/dev/null; echo $?`,
          wtPath
        );
        if (diffCheck === "0") {
          res.end(JSON.stringify({ status: "up_to_date", message: "\u5DF2\u7ECF\u662F\u6700\u65B0\uFF0C\u65E0\u9700\u5408\u5E76" }));
          return true;
        }

        try {
          execSync(`git merge-tree --write-tree ${baseBranch} ${currentBranch}`, {
            cwd: wtPath, encoding: "utf-8",
          });
          res.end(JSON.stringify({ status: "clean", message: "\u65E0\u51B2\u7A81\uFF0C\u53EF\u4EE5\u5408\u5E76" }));
        } catch {
          res.end(JSON.stringify({ status: "conflict", message: "\u68C0\u6D4B\u5230\u5408\u5E76\u51B2\u7A81" }));
        }
      } catch (e) {
        res.end(JSON.stringify({ status: "unknown", message: e.message }));
      }
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

      // Server-side behind guard
      let baseBranch = "dev";
      const metaPath = join(wtDir, "meta.json");
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(rd(metaPath));
          if (meta.baseBranch) baseBranch = meta.baseBranch;
        } catch {}
      }

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
      const filePath = join(wtDir, relPath);

      if (!filePath.startsWith(wtDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return true;
      }

      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end("File not found");
        return true;
      }

      const MIME_TYPES = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      };
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const st = statSync(filePath);

      res.writeHead(200, { "Content-Type": contentType, "Content-Length": st.size });
      createReadStream(filePath).pipe(res);
      return true;
    }

    return false;
  };
}
