#!/usr/bin/env node
/**
 * 命令: merge — 合并工作区分支回 base 分支
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  info, success, error, exec, execSafe, execInherit,
  PROJECT_ROOT, WORKTREES_DIR, getCurrentBranch,
} from "./_helpers.mjs";

export function cmdMerge(target) {
  if (!target) {
    error("用法: worktree merge <worktree-name>");
    console.log("");
    console.log("当前 worktrees:");
    console.log(exec("git worktree list"));
    process.exit(1);
  }

  const worktreePath = join(WORKTREES_DIR, target);

  if (!existsSync(worktreePath)) {
    error(`Worktree 不存在: ${worktreePath}`);
    process.exit(1);
  }

  const metaJson = join(worktreePath, ".worktree", "meta.json");
  if (!existsSync(metaJson)) {
    error("找不到 .worktree/meta.json，无法确定 base 分支");
    process.exit(1);
  }

  const meta = JSON.parse(readFileSync(metaJson, "utf-8"));
  const baseBranch = meta.baseBranch;
  if (!baseBranch) {
    error("meta.json 中没有 baseBranch 字段");
    process.exit(1);
  }

  const wtBranch = exec(`git -C "${worktreePath}" rev-parse --abbrev-ref HEAD`);

  // ── 前置检查 ──────────────────────────────────────────────

  // Check worktree for uncommitted changes
  const wtDirty =
    execSafe(`git -C "${worktreePath}" diff --quiet`) === null ||
    execSafe(`git -C "${worktreePath}" diff --cached --quiet`) === null;
  if (wtDirty) {
    error("工作区有未提交的更改，请先提交或 stash");
    console.log(exec(`git -C "${worktreePath}" status --short`));
    process.exit(1);
  }

  // Check main repo for uncommitted changes
  const mainDirty =
    execSafe(`git -C "${PROJECT_ROOT}" diff --quiet`) === null ||
    execSafe(`git -C "${PROJECT_ROOT}" diff --cached --quiet`) === null;
  if (mainDirty) {
    error("主仓库有未提交的更改，请先提交或 stash");
    console.log(exec(`git -C "${PROJECT_ROOT}" status --short`));
    process.exit(1);
  }

  // Check if worktree is behind base
  const behindCount = execSafe(`git -C "${worktreePath}" rev-list HEAD..${baseBranch} --count`) || "0";
  if (behindCount !== "0") {
    error(`工作区落后上游 ${behindCount} 个 commit，请先同步: make wt-sync`);
    process.exit(1);
  }

  // Check for merge conflicts
  if (execSafe(`git merge-tree --write-tree ${baseBranch} ${wtBranch}`) === null) {
    error("检测到合并冲突，请先在工作区中解决冲突");
    console.log("");
    console.log("提示：");
    console.log(`  cd ${worktreePath}`);
    console.log(`  git merge ${baseBranch}    # 解决冲突后 commit`);
    process.exit(1);
  }

  // ── 执行合并 ──────────────────────────────────────────────

  info(`合并 ${wtBranch} → ${baseBranch}`);

  const currentBranch = getCurrentBranch();

  if (currentBranch !== baseBranch) {
    info(`切换到 ${baseBranch} ...`);
    execInherit(`git checkout "${baseBranch}"`);
  }

  try {
    execInherit(`git merge --squash "${wtBranch}"`);
  } catch {
    error(`合并失败，回退到 ${currentBranch}`);
    execSafe("git merge --abort");
    if (currentBranch !== baseBranch) {
      execInherit(`git checkout "${currentBranch}"`);
    }
    process.exit(1);
  }

  // Check if there are staged changes
  const nothingToCommit = execSafe("git diff --cached --quiet") !== null;
  if (nothingToCommit) {
    success("已经是最新，无需合并");
    console.log("");
    console.log("下一步（可选）：");
    console.log(`  make wt-delete NAME=${target}    # 删除工作区`);
    return;
  }

  const commitLog = execSafe(`git log ${baseBranch}..${wtBranch} --oneline --no-merges`) || "";
  execInherit(`git commit -m "feat(${target}): squash merge from ${wtBranch}" -m "${commitLog.replace(/"/g, '\\"')}"`);
  success(`已合并 ${wtBranch} → ${baseBranch}（squash）`);

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

  console.log("");
  console.log("下一步（可选）：");
  console.log(`  make wt-delete NAME=${target}    # 删除工作区`);
}
