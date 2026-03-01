/**
 * Worktrees API routes — extracted from worktree-manager.mjs
 */

import { execSync, spawn } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

function parseWorktrees(PROJECT_ROOT) {
  const raw = exec("git worktree list --porcelain", PROJECT_ROOT);
  if (!raw) return [];
  const entries = [];
  let cur = {};
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (cur.path) entries.push(cur);
      cur = { path: line.slice(9) };
    } else if (line.startsWith("HEAD ")) {
      cur.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      cur.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      cur.bare = true;
    } else if (line === "detached") {
      cur.detached = true;
    }
  }
  if (cur.path) entries.push(cur);
  return entries;
}

function getWorktreeInfo(PROJECT_ROOT) {
  const all = parseWorktrees(PROJECT_ROOT);
  const worktrees = all.filter((w) => w.path !== PROJECT_ROOT && !w.bare);

  return worktrees.map((wt) => {
    const name = wt.path.split("/").pop();
    const metaPath = join(wt.path, ".worktree", "meta.json");
    let meta = {};
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {}
    }

    const logLine = exec(
      `git log -1 --format="%h|%s|%cr|%an" ${wt.branch || wt.head} --`,
      PROJECT_ROOT
    );
    const [hash, subject, date, author] = logLine.split("|");

    const dirty = exec(`git -C "${wt.path}" status --porcelain`, PROJECT_ROOT).length > 0;

    const baseBranch = meta.baseBranch || "dev";
    let merged = false;
    if (wt.branch) {
      const mergedBranches = exec(
        `git branch --merged ${baseBranch} --format="%(refname:short)"`,
        PROJECT_ROOT
      );
      merged = mergedBranches.split("\n").some((b) => b.trim() === wt.branch);
    }

    const ahead = wt.branch
      ? parseInt(exec(`git rev-list --count ${baseBranch}..${wt.branch}`, PROJECT_ROOT) || "0", 10)
      : 0;

    const devPort = meta.dev;
    let running = false;
    if (devPort) {
      const pid = exec(`lsof -ti:${devPort} 2>/dev/null`, PROJECT_ROOT);
      running = pid.length > 0;
    }

    const wtDir = join(wt.path, ".worktree");
    let reports = [];
    if (existsSync(wtDir)) {
      try {
        reports = readdirSync(wtDir).filter((f) => f.endsWith(".md"));
      } catch {}
    }

    return {
      name,
      path: wt.path,
      branch: wt.branch || "(detached)",
      baseBranch,
      head: hash || wt.head?.slice(0, 7),
      subject: subject || "",
      date: date || "",
      author: author || "",
      dirty,
      merged,
      ahead,
      devPort,
      running,
      reports,
      meta,
    };
  });
}

function getOrphanBranches(PROJECT_ROOT) {
  const mergedRaw = exec(
    `git branch --merged dev --list "dev-*" --format="%(refname:short)|%(committerdate:short)|%(committerdate:relative)|%(subject)"`,
    PROJECT_ROOT
  );
  if (!mergedRaw) return [];

  const activeWtBranches = new Set(
    parseWorktrees(PROJECT_ROOT)
      .filter((w) => w.branch)
      .map((w) => w.branch)
  );

  return mergedRaw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [branch, dateAbs, dateRel, subject] = line.split("|");
      return {
        branch: branch.trim(),
        date: dateAbs,
        dateRel,
        subject: subject || "",
        hasWorktree: activeWtBranches.has(branch.trim()),
      };
    })
    .filter((b) => !b.hasWorktree);
}

function getUnmergedBranches(PROJECT_ROOT) {
  const raw = exec(
    `git branch --no-merged dev --list "dev-*" --format="%(refname:short)|%(committerdate:short)|%(committerdate:relative)|%(subject)"`,
    PROJECT_ROOT
  );
  if (!raw) return [];

  const activeWtBranches = new Set(
    parseWorktrees(PROJECT_ROOT)
      .filter((w) => w.branch)
      .map((w) => w.branch)
  );

  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [branch, dateAbs, dateRel, subject] = line.split("|");
      return {
        branch: branch.trim(),
        date: dateAbs,
        dateRel,
        subject: subject || "",
        hasWorktree: activeWtBranches.has(branch.trim()),
      };
    })
    .filter((b) => !b.hasWorktree);
}

// ── SSE command runner ───────────────────────────────────────

function runCommand(res, cmd, args, cwd) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: true,
  });

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  child.stdout.on("data", (d) => {
    for (const line of d.toString().split("\n")) {
      if (line) send("stdout", line);
    }
  });

  child.stderr.on("data", (d) => {
    for (const line of d.toString().split("\n")) {
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
}

// ── Router ───────────────────────────────────────────────────

export function createWorktreesRouter(dirs) {
  const { PROJECT_ROOT } = dirs;

  return function worktreesRouter(req, res, url) {
    const path = url.pathname;

    if (path === "/api/worktrees/data" && req.method === "GET") {
      const currentBranch = exec("git rev-parse --abbrev-ref HEAD", PROJECT_ROOT);
      const result = {
        projectRoot: PROJECT_ROOT,
        currentBranch,
        worktrees: getWorktreeInfo(PROJECT_ROOT),
        orphanBranches: getOrphanBranches(PROJECT_ROOT),
        unmergedBranches: getUnmergedBranches(PROJECT_ROOT),
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    }

    if (path === "/api/worktrees/delete" && req.method === "POST") {
      const name = url.searchParams.get("name");
      if (!name) { res.writeHead(400); res.end("Missing name"); return true; }
      runCommand(res, "make", [`wt-delete`, `NAME=${name}`], PROJECT_ROOT);
      return true;
    }

    if (path === "/api/worktrees/delete-branch" && req.method === "POST") {
      const name = url.searchParams.get("name");
      if (!name) { res.writeHead(400); res.end("Missing name"); return true; }
      runCommand(res, "git", ["branch", "-d", name], PROJECT_ROOT);
      return true;
    }

    if (path === "/api/worktrees/force-delete" && req.method === "POST") {
      const name = url.searchParams.get("name");
      if (!name) { res.writeHead(400); res.end("Missing name"); return true; }
      runCommand(res, "git", ["branch", "-D", name], PROJECT_ROOT);
      return true;
    }

    if (path === "/api/worktrees/bulk-delete" && req.method === "POST") {
      const branches = url.searchParams.get("branches");
      if (!branches) { res.writeHead(400); res.end("Missing branches"); return true; }
      const list = branches.split(",").filter(Boolean);
      runCommand(res, "git", ["branch", "-d", ...list], PROJECT_ROOT);
      return true;
    }

    if (path === "/api/worktrees/delete-all-merged" && req.method === "POST") {
      const orphans = getOrphanBranches(PROJECT_ROOT);
      if (!orphans.length) {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
        res.write(`data: ${JSON.stringify({ type: "stdout", data: "No branches to delete" })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "exit", data: 0 })}\n\n`);
        res.end();
        return true;
      }
      const names = orphans.map((b) => b.branch);
      runCommand(res, "git", ["branch", "-d", ...names], PROJECT_ROOT);
      return true;
    }

    return false;
  };
}
