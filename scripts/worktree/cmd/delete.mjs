#!/usr/bin/env node
/**
 * 命令: delete — 删除 worktree
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  info, success, warn, error, exec, execSafe, execInherit,
  PROJECT_ROOT, WORKTREES_DIR,
  killWorktreeServices, resolveWorktreePath, confirm,
} from "./_helpers.mjs";

export async function cmdDelete(target) {
  if (!target) {
    error("用法: worktree delete <worktree-name>");
    console.log("");
    console.log("当前 worktrees:");
    console.log(exec("git worktree list"));
    process.exit(1);
  }

  const worktreePath = resolveWorktreePath(target);

  // Check for uncommitted changes
  if (existsSync(worktreePath)) {
    const dirty =
      execSafe(`git -C "${worktreePath}" diff --quiet`) === null ||
      execSafe(`git -C "${worktreePath}" diff --cached --quiet`) === null;

    if (dirty) {
      warn("Worktree 有未提交的更改!");
      console.log(exec(`git -C "${worktreePath}" status --short`));
      console.log("");
      const ok = await confirm("确定要删除吗? (y/N) ");
      if (!ok) {
        info("已取消");
        process.exit(0);
      }
    }
  }

  // Run cleanup script
  const wtConfigDir = join(worktreePath, ".worktree");
  if (existsSync(join(wtConfigDir, "cleanup.sh"))) {
    info("执行清理脚本...");
    try {
      execInherit(`bash "${join(wtConfigDir, "cleanup.sh")}"`, { cwd: worktreePath });
    } catch { /* ignore cleanup errors */ }
  }

  // Kill services
  killWorktreeServices(worktreePath);

  // Run wt-fini and wt-teardown
  execInherit(`node "${join(PROJECT_ROOT, "scripts", "worktree", "lifecycle", "wt-fini.mjs")}" "${worktreePath}"`);
  execInherit(`node "${join(PROJECT_ROOT, "scripts", "worktree", "lifecycle", "wt-teardown.mjs")}" "${worktreePath}"`);

  // Resolve branch name before removing worktree
  const branchName = execSafe(`git -C "${worktreePath}" rev-parse --abbrev-ref HEAD`);

  // Remove worktree
  info(`删除 worktree: ${worktreePath}`);
  execInherit(`git worktree remove "${worktreePath}" --force`);

  // Delete the associated branch
  if (branchName) {
    info(`删除分支: ${branchName}`);
    const result = execSafe(`git branch -D "${branchName}"`);
    if (result !== null) {
      success(`分支 ${branchName} 已删除`);
    } else {
      warn(`分支 ${branchName} 删除失败（可能已不存在）`);
    }
  }

  success("Worktree 已删除");
}
