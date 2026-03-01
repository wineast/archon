/**
 * Worktree Scanner service — scan worktrees, chain configs, read reports.
 * Zero HTTP awareness.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  exec,
  parseGitStatus,
  parseWorktreeList,
  getCurrentBranch,
  getBaseBranch,
  findUpstreamPath,
  getAheadBehind,
  getCommitLog,
  getDiffStat,
  getChangedFiles,
  getFileStatus,
  mergeCheck as gitMergeCheck,
} from "./git-ops";

// ── Types ───────────────────────────────────────────────────

export interface ChainReportConfig {
  key: string;
  path: string;
  label: string;
  badge: string;
  optional?: boolean;
}

export interface ChainStepConfig {
  key: string;
  label: string;
  cssClass: string;
  optional?: boolean;
}

export interface ChainConfig {
  reports: ChainReportConfig[];
  chain: ChainStepConfig[];
  verdictSource: string;
}

export interface TaskRef {
  type: string;
  id: string;
  [key: string]: unknown;
}

export interface ScannedWorktree {
  name: string;
  path: string;
  taskRef: TaskRef | null;
  terminals: string[];
  meta: Record<string, unknown>;
  remoteUrl: string;
  reqChain: Record<string, boolean> | null;
  defectChain: Record<string, boolean> | null;
}

export interface ChainStatus {
  chain: Array<ChainStepConfig & { available: boolean }>;
  reports: Record<string, string | null>;
  verdictSource: string;
}

export interface WorktreeInfo {
  name: string;
  path: string;
  branch: string;
  baseBranch: string;
  head: string;
  subject: string;
  date: string;
  author: string;
  dirty: boolean;
  merged: boolean;
  ahead: number;
  devPort: unknown;
  running: boolean;
  reports: string[];
  meta: Record<string, unknown>;
}

export interface OrphanBranch {
  branch: string;
  date: string;
  dateRel: string;
  subject: string;
  hasWorktree: boolean;
}

// ── Chain Configs ───────────────────────────────────────────

export const REQ_CHAIN: ChainConfig = {
  reports: [
    {
      key: "req",
      path: "REQ.md",
      label: "需求报告",
      badge: "req",
      optional: true,
    },
    {
      key: "impl",
      path: "IMPL_REPORT.md",
      label: "实现报告",
      badge: "impl",
      optional: true,
    },
    {
      key: "accept",
      path: "ACCEPT_REPORT.md",
      label: "验收报告",
      badge: "accept",
      optional: true,
    },
    {
      key: "guard",
      path: "CAP_GUARD.md",
      label: "守护规约",
      badge: "guard",
      optional: true,
    },
    {
      key: "report",
      path: "CAP_GUARD_REPORT.md",
      label: "守护报告",
      badge: "report",
      optional: true,
    },
  ],
  chain: [
    { key: "req", label: "需求报告", cssClass: "req" },
    { key: "impl", label: "实现报告", cssClass: "impl" },
    { key: "accept", label: "验收报告", cssClass: "accept" },
    { key: "guard", label: "守护规约", cssClass: "guard", optional: true },
    { key: "report", label: "守护报告", cssClass: "report", optional: true },
  ],
  verdictSource: "accept",
};

export const DEFECT_CHAIN: ChainConfig = {
  reports: [
    {
      key: "defect",
      path: "DEFECT.md",
      label: "缺陷报告",
      badge: "defect",
      optional: true,
    },
    {
      key: "fix",
      path: "FIX_REPORT.md",
      label: "修复报告",
      badge: "fix",
      optional: true,
    },
    {
      key: "verify",
      path: "VERIFY_REPORT.md",
      label: "验证报告",
      badge: "verify",
      optional: true,
    },
    {
      key: "guard",
      path: "TEST_SPEC.md",
      label: "守护规约",
      badge: "guard",
      optional: true,
    },
    {
      key: "report",
      path: "TEST_SPEC_REPORT.md",
      label: "守护报告",
      badge: "report",
      optional: true,
    },
  ],
  chain: [
    { key: "defect", label: "缺陷报告", cssClass: "defect" },
    { key: "fix", label: "修复报告", cssClass: "fix" },
    { key: "verify", label: "验证报告", cssClass: "verify" },
    { key: "guard", label: "守护规约", cssClass: "guard", optional: true },
    { key: "report", label: "守护报告", cssClass: "report", optional: true },
  ],
  verdictSource: "verify",
};

// ── Chain detection ─────────────────────────────────────────

export function detectChainType(wtDir: string): "req" | "defect" | null {
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

export function getChainConfig(type: string): ChainConfig {
  return type === "defect" ? DEFECT_CHAIN : REQ_CHAIN;
}

// ── Worktree scanning ───────────────────────────────────────

export function scanWorktrees(WORKTREES_DIR: string): ScannedWorktree[] {
  if (!existsSync(WORKTREES_DIR)) return [];
  const result: ScannedWorktree[] = [];

  for (const name of readdirSync(WORKTREES_DIR)) {
    const wtPath = join(WORKTREES_DIR, name);
    const wtDir = join(wtPath, ".worktree");
    if (!existsSync(wtDir)) continue;

    let taskRef: TaskRef | null = null;
    const taskJsonPath = join(wtDir, "task.json");
    if (existsSync(taskJsonPath)) {
      try {
        taskRef = JSON.parse(readFileSync(taskJsonPath, "utf-8"));
      } catch {}
    }

    let meta: Record<string, unknown> = {};
    const metaPath = join(wtDir, "meta.json");
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {}
    }

    const reqChain: Record<string, boolean> = {
      "REQ.md": existsSync(join(wtDir, "REQ.md")),
      "IMPL_REPORT.md": existsSync(join(wtDir, "IMPL_REPORT.md")),
      "ACCEPT_REPORT.md": existsSync(join(wtDir, "ACCEPT_REPORT.md")),
      "CAP_GUARD.md": existsSync(join(wtDir, "CAP_GUARD.md")),
      "CAP_GUARD_REPORT.md": existsSync(join(wtDir, "CAP_GUARD_REPORT.md")),
    };
    const defectChain: Record<string, boolean> = {
      "DEFECT.md": existsSync(join(wtDir, "DEFECT.md")),
      "FIX_REPORT.md": existsSync(join(wtDir, "FIX_REPORT.md")),
      "VERIFY_REPORT.md": existsSync(join(wtDir, "VERIFY_REPORT.md")),
      "TEST_SPEC.md": existsSync(join(wtDir, "TEST_SPEC.md")),
      "TEST_SPEC_REPORT.md": existsSync(join(wtDir, "TEST_SPEC_REPORT.md")),
    };

    const taskType = taskRef?.type;
    let showReqChain: Record<string, boolean> | null = null;
    let showDefectChain: Record<string, boolean> | null = null;
    if (taskType === "todo") {
      showReqChain = reqChain;
    } else if (taskType === "issue") {
      showDefectChain = defectChain;
    } else {
      if (Object.values(reqChain).some(Boolean)) showReqChain = reqChain;
      if (Object.values(defectChain).some(Boolean))
        showDefectChain = defectChain;
    }

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
      terminals: [], // populated by buildData() from termManager
      meta,
      remoteUrl,
      reqChain: showReqChain,
      defectChain: showDefectChain,
    });
  }

  return result;
}

// ── Report reading ──────────────────────────────────────────

function rd(p: string): string | null {
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

export function buildChainStatus(
  wtDir: string,
  chainType: string
): ChainStatus {
  const config = getChainConfig(chainType);

  const reports: Record<string, string | null> = {};
  for (const r of config.reports) {
    reports[r.key] = rd(join(wtDir, r.path));
  }

  const chain = config.chain.map((c) => {
    const rpt = config.reports.find((r) => r.key === c.key);
    const available = rpt ? existsSync(join(wtDir, rpt.path)) : false;
    return { ...c, available };
  });

  return { chain, reports, verdictSource: config.verdictSource };
}

export function readReportData(wtName: string, WORKTREES_DIR: string) {
  const wtPath = join(WORKTREES_DIR, wtName);
  const wtDir = join(wtPath, ".worktree");
  if (!existsSync(wtPath)) return null;

  const chainType = detectChainType(wtDir);
  const { chain, reports, verdictSource } = buildChainStatus(wtDir, chainType ?? "req");

  const branch = getCurrentBranch(wtPath);
  const baseBranch = getBaseBranch(wtDir);

  return {
    worktree: wtName,
    chainType,
    chain,
    reports,
    verdictSource,
    branch,
    baseBranch,
  };
}

export function readStatusData(
  wtName: string,
  WORKTREES_DIR: string,
  PROJECT_ROOT: string
) {
  const wtPath = join(WORKTREES_DIR, wtName);
  const wtDir = join(wtPath, ".worktree");
  if (!existsSync(wtPath)) return null;

  const baseBranch = getBaseBranch(wtDir);
  const currentBranch = getCurrentBranch(wtPath);
  const upstreamPath = findUpstreamPath(wtPath, baseBranch, PROJECT_ROOT);

  const result: Record<string, unknown> = { current: {}, upstream: {} };
  try {
    const curStatus = parseGitStatus(wtPath);
    const { ahead, behind } = getAheadBehind(wtPath, baseBranch);
    result.current = { branch: currentBranch, ...curStatus, ahead, behind };

    const upStatus = parseGitStatus(upstreamPath);
    result.upstream = { branch: baseBranch, path: upstreamPath, ...upStatus };

    result.commits = getCommitLog(wtPath, baseBranch);
    result.diffStat = getDiffStat(wtPath, baseBranch);
    result.changedFiles = getChangedFiles(wtPath, baseBranch);
    result.files = getFileStatus(wtPath);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

export function readMergeCheck(
  wtName: string,
  WORKTREES_DIR: string,
  PROJECT_ROOT: string,
  mergeStates: Map<string, string>
) {
  if (mergeStates.get(wtName) === "success") {
    return { status: "merged", message: "已合并" };
  }

  const wtPath = join(WORKTREES_DIR, wtName);
  const wtDir = join(wtPath, ".worktree");
  const baseBranch = getBaseBranch(wtDir);
  const currentBranch = getCurrentBranch(wtPath);

  if (!baseBranch || !currentBranch) {
    return { status: "unknown", message: "Cannot determine branches" };
  }

  // dirty check on worktree
  const wtStatus = parseGitStatus(wtPath);
  if (wtStatus.staged > 0 || wtStatus.unstaged > 0) {
    return { status: "dirty", message: "工作区有未提交的变更" };
  }

  // dirty check on upstream
  const upstreamPath = findUpstreamPath(wtPath, baseBranch, PROJECT_ROOT);
  if (upstreamPath) {
    const upStatus = parseGitStatus(upstreamPath);
    if (upStatus.staged > 0 || upStatus.unstaged > 0) {
      return { status: "dirty", message: "上游仓库有未提交的变更" };
    }
  }

  return gitMergeCheck(wtPath, baseBranch, currentBranch);
}

// ── Report list ─────────────────────────────────────────────

export function listReportWorktrees(
  WORKTREES_DIR: string
): Array<{ name: string; chainType: string }> {
  const result: Array<{ name: string; chainType: string }> = [];
  if (!existsSync(WORKTREES_DIR)) return result;
  for (const name of readdirSync(WORKTREES_DIR)) {
    const wtDir = join(WORKTREES_DIR, name, ".worktree");
    if (!existsSync(wtDir)) continue;
    const chainType = detectChainType(wtDir);
    if (!chainType) continue;
    result.push({ name, chainType });
  }
  return result;
}

// ── Worktree detail info (for worktrees panel) ─────────────

export function getWorktreeInfo(PROJECT_ROOT: string): WorktreeInfo[] {
  const all = parseWorktreeList(PROJECT_ROOT);
  const worktrees = all.filter((w) => w.path !== PROJECT_ROOT && !w.bare);

  return worktrees.map((wt) => {
    const name = wt.path.split("/").pop()!;
    const metaPath = join(wt.path, ".worktree", "meta.json");
    let meta: Record<string, unknown> = {};
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

    const dirty =
      exec(`git -C "${wt.path}" status --porcelain`, PROJECT_ROOT).length > 0;

    const baseBranch = (meta.baseBranch as string) || "dev";
    let merged = false;
    if (wt.branch) {
      const mergedBranches = exec(
        `git branch --merged ${baseBranch} --format="%(refname:short)"`,
        PROJECT_ROOT
      );
      merged = mergedBranches.split("\n").some((b) => b.trim() === wt.branch);
    }

    const ahead = wt.branch
      ? parseInt(
          exec(
            `git rev-list --count ${baseBranch}..${wt.branch}`,
            PROJECT_ROOT
          ) || "0",
          10
        )
      : 0;

    const devPort = meta.dev;
    let running = false;
    if (devPort) {
      const pid = exec(`lsof -ti:${devPort} 2>/dev/null`, PROJECT_ROOT);
      running = pid.length > 0;
    }

    const wtDir = join(wt.path, ".worktree");
    let reports: string[] = [];
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
      head: hash || wt.head?.slice(0, 7) || "",
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

export function getOrphanBranches(PROJECT_ROOT: string): OrphanBranch[] {
  const mergedRaw = exec(
    `git branch --merged dev --list "dev-*" --format="%(refname:short)|%(committerdate:short)|%(committerdate:relative)|%(subject)"`,
    PROJECT_ROOT
  );
  if (!mergedRaw) return [];

  const activeWtBranches = new Set(
    parseWorktreeList(PROJECT_ROOT)
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
