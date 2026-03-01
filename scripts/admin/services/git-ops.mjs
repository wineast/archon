/**
 * Git operations service — shared git helpers.
 * Merged from 3 duplicate `exec()` wrappers + reports.mjs git helpers +
 * worktrees.mjs `parseWorktrees` / branch helpers.
 * Zero HTTP awareness.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Shell exec ──────────────────────────────────────────────

export function exec(cmd, cwd, opts = {}) {
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

// ── Git status parsing ──────────────────────────────────────

export function parseGitStatus(cwd) {
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

export function getAheadBehind(cwd, baseBranch) {
  const ahead = parseInt(exec(`git rev-list ${baseBranch}..HEAD --count`, cwd)) || 0;
  const behind = parseInt(exec(`git rev-list HEAD..${baseBranch} --count`, cwd)) || 0;
  return { ahead, behind };
}

export function getCurrentBranch(cwd) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd, encoding: "utf-8",
    }).trim();
  } catch {
    return "";
  }
}

export function getCommitLog(cwd, baseBranch) {
  const logRaw = exec(
    `git log ${baseBranch}..HEAD --pretty=format:"%h|%s|%an|%ar" --no-merges`,
    cwd
  );
  return logRaw
    ? logRaw.split("\n").map((line) => {
        const [hash, subject, author, date] = line.split("|");
        return { hash, subject, author, date };
      })
    : [];
}

export function getDiffStat(cwd, baseBranch) {
  return exec(`git diff ${baseBranch}...HEAD --stat --stat-width=60`, cwd);
}

export function getChangedFiles(cwd, baseBranch) {
  const raw = exec(`git diff ${baseBranch}...HEAD --name-status`, cwd);
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((line) => {
    const [status, ...parts] = line.split("\t");
    return { status: status.trim(), path: parts.join("\t") };
  });
}

/**
 * Parse `git status --short` into per-file entries.
 * Returns [{ x, y, path }] where x=staging status, y=working tree status.
 */
export function getFileStatus(cwd) {
  const raw = exec("git status --short", cwd);
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((line) => {
    const x = line[0];
    const y = line[1];
    const path = line.slice(3);
    return { x, y, path };
  });
}

export function mergeCheck(cwd, baseBranch, currentBranch) {
  const behind = exec(`git rev-list HEAD..${baseBranch} --count`, cwd);
  if (behind !== "0") {
    return { status: "behind", behind: parseInt(behind), message: `落后上游 ${behind} 个 commit` };
  }

  const diffCheck = exec(
    `git diff ${baseBranch}..HEAD --quiet 2>/dev/null; echo $?`,
    cwd
  );
  if (diffCheck === "0") {
    return { status: "up_to_date", message: "已经是最新，无需合并" };
  }

  try {
    execSync(`git merge-tree --write-tree ${baseBranch} ${currentBranch}`, {
      cwd, encoding: "utf-8",
    });
    return { status: "clean", message: "无冲突，可以合并" };
  } catch {
    return { status: "conflict", message: "检测到合并冲突" };
  }
}

// ── Worktree list parsing ───────────────────────────────────

export function parseWorktreeList(projectRoot) {
  const raw = exec("git worktree list --porcelain", projectRoot);
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

/**
 * Find the filesystem path of the worktree checked out on `baseBranch`.
 */
export function findUpstreamPath(cwd, baseBranch, projectRoot) {
  try {
    const raw = execSync("git worktree list --porcelain", {
      cwd, encoding: "utf-8",
    });
    for (const entry of raw.split("\n\n").filter(Boolean)) {
      const lines = entry.split("\n");
      const pl = lines.find((l) => l.startsWith("worktree "));
      const bl = lines.find((l) => l.startsWith("branch "));
      if (pl && bl) {
        const sb = bl.replace("branch ", "").replace("refs/heads/", "");
        if (sb === baseBranch) {
          return pl.replace("worktree ", "");
        }
      }
    }
  } catch {}
  return projectRoot;
}

/**
 * Read meta.json baseBranch (fallback "dev").
 */
export function getBaseBranch(wtDir) {
  const metaPath = join(wtDir, "meta.json");
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      if (meta.baseBranch) return meta.baseBranch;
    } catch {}
  }
  return "dev";
}
