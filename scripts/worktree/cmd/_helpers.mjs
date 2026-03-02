#!/usr/bin/env node
/**
 * Worktree 脚本共享辅助函数和常量
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, symlinkSync, unlinkSync, rmSync, statSync, lstatSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { createInterface } from "node:readline";

// ── 颜色 ────────────────────────────────────────────────────

const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[1;33m";
const BLUE = "\x1b[0;34m";
const NC = "\x1b[0m";

// ── 日志 ────────────────────────────────────────────────────

export function info(msg) {
  console.log(`${BLUE}[INFO]${NC} ${msg}`);
}

export function success(msg) {
  console.log(`${GREEN}[OK]${NC} ${msg}`);
}

export function warn(msg) {
  console.log(`${YELLOW}[WARN]${NC} ${msg}`);
}

export function error(msg) {
  console.error(`${RED}[ERROR]${NC} ${msg}`);
}

// ── Shell 执行 ──────────────────────────────────────────────

/**
 * 执行 shell 命令，返回 stdout（trimmed）
 * 失败时抛出异常（等价于 set -e）
 */
export function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf-8", ...opts }).trim();
}

/**
 * 执行 shell 命令，失败时返回 null 而非抛出
 */
export function execSafe(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf-8", ...opts }).trim();
  } catch {
    return null;
  }
}

/**
 * 执行 shell 命令，直接继承 stdio（输出不捕获，直接打印到终端）
 */
export function execInherit(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", ...opts });
}

// ── 常量 ────────────────────────────────────────────────────

export const PROJECT_ROOT = exec("git rev-parse --show-toplevel");
export const WORKTREES_DIR = join(PROJECT_ROOT, ".worktrees");
export const WORKTREE_CONFIG_DIR = join(PROJECT_ROOT, ".worktree");

// ── 辅助函数 ────────────────────────────────────────────────

export function getCurrentBranch() {
  return exec("git rev-parse --abbrev-ref HEAD");
}

export function getDateSuffix() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function ensureWorktreesDir() {
  if (!existsSync(WORKTREES_DIR)) {
    info("创建 .worktrees/ 目录...");
    mkdirSync(WORKTREES_DIR, { recursive: true });
  }
  const ignored = execSafe(`git check-ignore -q ".worktrees"`);
  // execSafe returns null on non-zero exit (not ignored)
  if (ignored === null) {
    warn(".worktrees/ 未被 gitignore，自动修复...");
    const gitignorePath = join(PROJECT_ROOT, ".gitignore");
    let content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
    content += "\n# Worktrees directory\n.worktrees/\n";
    writeFileSync(gitignorePath, content);
    execInherit("git add .gitignore");
    execInherit('git commit -m "chore: add .worktrees/ to gitignore"');
    success("已自动添加 .worktrees/ 到 .gitignore 并提交");
  }
}

export function linkAutoMemory(wtPath) {
  const mainKey = PROJECT_ROOT.replace(/\//g, "-");
  const wtKey = wtPath.replace(/\//g, "-");
  const claudeProjects = join(process.env.HOME, ".claude", "projects");
  const mainMemory = join(claudeProjects, mainKey, "memory");
  const wtParent = join(claudeProjects, wtKey);
  const wtMemory = join(wtParent, "memory");

  if (!existsSync(mainMemory)) {
    warn("主项目 auto memory 不存在，跳过链接");
    return;
  }

  mkdirSync(wtParent, { recursive: true });

  // If wtMemory exists and is NOT a symlink, remove it
  try {
    const lstat = lstatSync(wtMemory);
    if (!lstat.isSymbolicLink()) {
      rmSync(wtMemory, { recursive: true, force: true });
    } else {
      unlinkSync(wtMemory);
    }
  } catch { /* not exists */ }
  symlinkSync(mainMemory, wtMemory);
  info("已链接 auto memory → main");
}

export function killWorktreeServices(wtPath) {
  const meta = join(wtPath, ".worktree", "meta.json");
  let killed = 0;

  // Kill port-based services
  if (existsSync(meta)) {
    try {
      const m = JSON.parse(readFileSync(meta, "utf-8"));
      for (const key of ["dev", "storybook", "studio"]) {
        const port = m[key];
        if (!port) continue;
        const pids = execSafe(`lsof -ti :${port}`);
        if (pids) {
          for (const p of pids.split("\n").filter(Boolean)) {
            try {
              process.kill(Number(p));
              killed++;
            } catch { /* already dead */ }
          }
        }
      }
    } catch { /* parse error */ }
  }

  if (killed > 0) {
    info(`已终止 ${killed} 个工作区服务`);
    // Brief pause to let ports release
    execSync("sleep 1");
  }
}

/**
 * 交互式确认（readline），返回 true/false
 */
export function confirm(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

/**
 * 查找模糊匹配的 worktree 路径
 * 如果精确匹配存在，直接返回；否则模糊搜索
 */
export function resolveWorktreePath(target) {
  const exact = join(WORKTREES_DIR, target);
  if (existsSync(exact)) return exact;

  if (!existsSync(WORKTREES_DIR)) {
    error(`找不到匹配的 worktree: ${target}`);
    process.exit(1);
  }

  const matches = readdirSync(WORKTREES_DIR)
    .filter((name) => name.includes(target))
    .map((name) => join(WORKTREES_DIR, name))
    .filter((p) => statSync(p).isDirectory());

  if (matches.length === 0) {
    error(`找不到匹配的 worktree: ${target}`);
    process.exit(1);
  }
  if (matches.length > 1) {
    error("匹配到多个 worktree，请指定更精确的名称:");
    matches.forEach((m) => console.log(`  ${m}`));
    process.exit(1);
  }
  return matches[0];
}
