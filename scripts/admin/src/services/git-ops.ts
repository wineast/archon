/**
 * Git operations service — shared git helpers.
 * Zero HTTP awareness.
 */

import { execSync } from "node:child_process";
import {
  readFileSync,
  existsSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────

export interface CommitLogEntry {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export interface ChangedFile {
  status: string;
  path: string;
}

export interface FileStatusEntry {
  x: string;
  y: string;
  path: string;
}

export interface GitStatusCounts {
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface MergeCheckResult {
  status: "behind" | "up_to_date" | "clean" | "conflict";
  behind?: number;
  message: string;
}

export interface WorktreeEntry {
  path: string;
  head?: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
}

// ── Shell exec ──────────────────────────────────────────────

export function exec(
  cmd: string,
  cwd: string,
  opts: Record<string, unknown> = {}
): string {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 15000,
      ...opts,
    }).trimEnd();
  } catch {
    return "";
  }
}

// ── Git status parsing ──────────────────────────────────────

export function parseGitStatus(cwd: string): GitStatusCounts {
  const raw = exec("git status --short", cwd);
  if (!raw) return { staged: 0, unstaged: 0, untracked: 0 };
  let staged = 0,
    unstaged = 0,
    untracked = 0;
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const x = line[0];
    const y = line[1];
    if (x === "?" && y === "?") {
      untracked++;
      continue;
    }
    if (x !== " " && x !== "?") staged++;
    if (y !== " " && y !== "?") unstaged++;
  }
  return { staged, unstaged, untracked };
}

export function getAheadBehind(
  cwd: string,
  baseBranch: string
): { ahead: number; behind: number } {
  const ahead =
    parseInt(exec(`git rev-list ${baseBranch}..HEAD --count`, cwd)) || 0;
  const behind =
    parseInt(exec(`git rev-list HEAD..${baseBranch} --count`, cwd)) || 0;
  return { ahead, behind };
}

export function getCurrentBranch(cwd: string): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "";
  }
}

export function getCommitLog(
  cwd: string,
  baseBranch: string
): CommitLogEntry[] {
  const logRaw = exec(
    `git log ${baseBranch}..HEAD --pretty=format:"%h|%s|%an|%ar"`,
    cwd
  );
  return logRaw
    ? logRaw.split("\n").map((line) => {
        const [hash, subject, author, date] = line.split("|");
        return { hash, subject, author, date };
      })
    : [];
}

export function getDiffStat(cwd: string, baseBranch: string): string {
  return exec(`git diff ${baseBranch}...HEAD --stat --stat-width=60`, cwd);
}

export function getChangedFiles(
  cwd: string,
  baseBranch: string
): ChangedFile[] {
  const raw = exec(`git diff ${baseBranch}...HEAD --name-status`, cwd);
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...parts] = line.split("\t");
      return { status: status.trim(), path: parts.join("\t") };
    });
}

/**
 * Parse `git status --short -u` into per-file entries.
 * Returns [{ x, y, path }] where x=staging status, y=working tree status.
 * -u lists individual untracked files instead of directories.
 */
export function getFileStatus(cwd: string): FileStatusEntry[] {
  const raw = exec("git status --short -u", cwd);
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const x = line[0];
      const y = line[1];
      const path = line.slice(3).replace(/\/+$/, "");
      return { x, y, path };
    });
}

export function mergeCheck(
  cwd: string,
  baseBranch: string,
  currentBranch: string
): MergeCheckResult {
  const behind = exec(`git rev-list HEAD..${baseBranch} --count`, cwd);
  if (behind !== "0") {
    return {
      status: "behind",
      behind: parseInt(behind),
      message: `落后上游 ${behind} 个 commit`,
    };
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
      cwd,
      encoding: "utf-8",
    });
    return { status: "clean", message: "无冲突，可以合并" };
  } catch {
    return { status: "conflict", message: "检测到合并冲突" };
  }
}

// ── Worktree list parsing ───────────────────────────────────

export function parseWorktreeList(projectRoot: string): WorktreeEntry[] {
  const raw = exec("git worktree list --porcelain", projectRoot);
  if (!raw) return [];
  const entries: WorktreeEntry[] = [];
  let cur: Partial<WorktreeEntry> = {};
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (cur.path) entries.push(cur as WorktreeEntry);
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
  if (cur.path) entries.push(cur as WorktreeEntry);
  return entries;
}

/**
 * Find the filesystem path of the worktree checked out on `baseBranch`.
 */
export function findUpstreamPath(
  cwd: string,
  baseBranch: string,
  projectRoot: string
): string {
  try {
    const raw = execSync("git worktree list --porcelain", {
      cwd,
      encoding: "utf-8",
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

// ── File diff ───────────────────────────────────────────────

export type DiffSource = "committed" | "staged" | "working" | "untracked";

/**
 * Get unified diff for a single file.
 */
export function getFileDiff(
  cwd: string,
  baseBranch: string,
  filePath: string,
  source: DiffSource
): string {
  switch (source) {
    case "committed":
      return exec(`git diff ${baseBranch}...HEAD -- "${filePath}"`, cwd, {
        timeout: 30000,
      });
    case "staged":
      return exec(`git diff --cached -- "${filePath}"`, cwd, {
        timeout: 30000,
      });
    case "working":
      return exec(`git diff -- "${filePath}"`, cwd, { timeout: 30000 });
    case "untracked": {
      const fullPath = join(cwd, filePath);
      if (!existsSync(fullPath)) return "";
      const stat = statSync(fullPath);
      if (stat.isDirectory()) return "";
      // Binary check: read first 8KB, look for null bytes
      const buf = Buffer.alloc(8192);
      const fd = openSync(fullPath, "r");
      const bytesRead = readSync(fd, buf, 0, 8192, 0);
      closeSync(fd);
      if (buf.subarray(0, bytesRead).includes(0)) {
        return `diff --git a/${filePath} b/${filePath}\nnew file\nBinary file`;
      }
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      // Remove trailing empty line from final newline
      if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
      const plusLines = lines.map((l) => `+${l}`).join("\n");
      return `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${plusLines}`;
    }
    default:
      return "";
  }
}

/**
 * Read meta.json baseBranch (fallback "dev").
 */
export function getBaseBranch(wtDir: string): string {
  const metaPath = join(wtDir, "meta.json");
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      if (meta.baseBranch) return meta.baseBranch;
    } catch {}
  }
  return "dev";
}
