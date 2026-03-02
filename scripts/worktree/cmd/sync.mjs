#!/usr/bin/env node
/**
 * 命令: sync — 同步上游分支到当前工作区
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  info, success, error, exec, execSafe, execInherit,
  PROJECT_ROOT, getCurrentBranch,
} from "./_helpers.mjs";

export function cmdSync() {
  const meta = join(PROJECT_ROOT, ".worktree", "meta.json");
  if (!existsSync(meta)) {
    error("当前不在 worktree 中（找不到 .worktree/meta.json）");
    process.exit(1);
  }

  const metaData = JSON.parse(readFileSync(meta, "utf-8"));
  const baseBranch = metaData.baseBranch;
  if (!baseBranch) {
    error("无法读取 base 分支");
    process.exit(1);
  }

  info(`当前分支: ${getCurrentBranch()}`);
  info(`上游分支: ${baseBranch} (本地)`);

  // Check for uncommitted changes
  const dirty =
    execSafe("git diff --quiet") === null ||
    execSafe("git diff --cached --quiet") === null;
  if (dirty) {
    error("工作区有未提交的变更，请先提交后再同步");
    process.exit(1);
  }

  // Check upstream worktree for uncommitted changes
  const wtListOutput = exec("git worktree list --porcelain");
  let upstreamPath = null;
  const lines = wtListOutput.split("\n");
  let currentPath = null;
  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length);
    }
    if (line.startsWith("branch ") && line === `branch refs/heads/${baseBranch}`) {
      upstreamPath = currentPath;
    }
  }

  if (upstreamPath) {
    const upstreamDirty =
      execSafe(`git -C "${upstreamPath}" diff --quiet`) === null ||
      execSafe(`git -C "${upstreamPath}" diff --cached --quiet`) === null;
    if (upstreamDirty) {
      error(`上游工作区 (${upstreamPath}) 有未提交的修改，请先去上游提交`);
      process.exit(1);
    }
  }

  // Rebase
  info(`变基到 ${baseBranch}...`);
  try {
    execInherit(`git rebase "${baseBranch}"`);
    success("变基成功");
  } catch {
    error("变基有冲突，请解决后执行 git rebase --continue");
    process.exit(1);
  }

  // Check for dependency changes
  const mergeDiff = execSafe("git diff HEAD~1 --name-only") || "";
  if (mergeDiff.includes("package-lock.json") || mergeDiff.includes("package.json")) {
    info("检测到依赖文件变更，执行 npm install...");
    const webDir = join(PROJECT_ROOT, "web");
    if (existsSync(webDir)) {
      execInherit("npm install", { cwd: webDir });
      success("依赖安装完成");
    }
  }

  success("同步完成");
}
