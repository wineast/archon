#!/usr/bin/env node
/**
 * 命令: delete — 删除 worktree
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync, cpSync } from "node:fs";
import { join, basename } from "node:path";
import {
  info, success, warn, error, exec, execSafe, execInherit,
  PROJECT_ROOT, WORKTREES_DIR, WORKTREE_CONFIG_DIR,
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

  // Archive report chain
  const wtConfigDir = join(worktreePath, ".worktree");
  if (existsSync(wtConfigDir)) {
    const wtName = basename(worktreePath);
    const archiveDir = join(WORKTREE_CONFIG_DIR, "sub-worktrees", wtName);
    info(`归档报告链到 ${archiveDir} ...`);
    mkdirSync(archiveDir, { recursive: true });
    const skipFiles = new Set(["meta.json", "viewer.json", "cleanup.sh"]);
    for (const fname of readdirSync(wtConfigDir)) {
      if (skipFiles.has(fname)) continue;
      try {
        cpSync(join(wtConfigDir, fname), join(archiveDir, fname), { recursive: true });
      } catch { /* skip */ }
    }
    success("报告链已归档");
  }

  // Run cleanup script
  if (existsSync(join(wtConfigDir, "cleanup.sh"))) {
    info("执行清理脚本...");
    try {
      execInherit(`bash "${join(wtConfigDir, "cleanup.sh")}"`, { cwd: worktreePath });
    } catch { /* ignore cleanup errors */ }
  }

  // Kill services
  killWorktreeServices(worktreePath);

  // Run wt-fini and wt-teardown
  execInherit(`node "${join(PROJECT_ROOT, "scripts", "wt-fini.mjs")}" "${worktreePath}"`);
  execInherit(`node "${join(PROJECT_ROOT, "scripts", "wt-teardown.mjs")}" "${worktreePath}"`);

  // Remove worktree
  info(`删除 worktree: ${worktreePath}`);
  execInherit(`git worktree remove "${worktreePath}" --force`);

  success("Worktree 已删除");
}
