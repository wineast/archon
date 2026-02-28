#!/usr/bin/env node
/**
 * 命令: create — 创建新 worktree
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  info, success, warn, error, exec, execSafe, execInherit,
  PROJECT_ROOT, WORKTREES_DIR, WORKTREE_CONFIG_DIR,
  ensureWorktreesDir, getCurrentBranch, getDateSuffix, linkAutoMemory,
} from "./_helpers.mjs";

export function cmdCreate(branchName, baseBranch) {
  if (!branchName) {
    error("用法: worktree create <branch-name> [base-branch]");
    console.log("");
    console.log("参数:");
    console.log("  branch-name   新 worktree 的名称");
    console.log("  base-branch   基础分支（可选，默认当前分支）");
    console.log("");
    console.log("示例:");
    console.log("  worktree create feature-auth          # 基于当前分支");
    console.log("  worktree create hotfix main           # 基于 main 分支");
    console.log("  worktree create fix-bug staging       # 基于 staging 分支");
    process.exit(1);
  }

  ensureWorktreesDir();

  if (!baseBranch) {
    baseBranch = getCurrentBranch();
    info(`使用当前分支作为基础: ${baseBranch}`);
  } else {
    const localExists = execSafe(`git show-ref --verify --quiet refs/heads/${baseBranch}`) !== null;
    if (!localExists) {
      const remoteExists = execSafe(`git show-ref --verify --quiet refs/remotes/origin/${baseBranch}`) !== null;
      if (remoteExists) {
        info(`从远程获取分支: origin/${baseBranch}`);
        execSafe(`git fetch origin ${baseBranch}:${baseBranch}`);
      } else {
        error(`分支不存在: ${baseBranch}`);
        console.log("可用的本地分支:");
        console.log(exec("git branch --list").replace(/^/gm, "  "));
        process.exit(1);
      }
    }
    info(`使用指定分支作为基础: ${baseBranch}`);
  }

  const dateSuffix = getDateSuffix();
  const fullBranch = `${baseBranch}-${branchName}-${dateSuffix}`;
  const worktreePath = join(WORKTREES_DIR, branchName);

  if (existsSync(worktreePath)) {
    error(`Worktree 已存在: ${worktreePath}`);
    process.exit(1);
  }

  const branchExists = execSafe(`git show-ref --verify --quiet refs/heads/${fullBranch}`) !== null;
  if (branchExists) {
    warn(`分支 ${fullBranch} 已存在，使用已有分支`);
    execInherit(`git worktree add "${worktreePath}" "${fullBranch}"`);
  } else {
    info(`创建新分支: ${fullBranch} (基于 ${baseBranch})`);
    execInherit(`git worktree add -b "${fullBranch}" "${worktreePath}" "${baseBranch}"`);
  }

  success(`Worktree 创建成功: ${worktreePath}`);

  // Copy .vercel config
  const vercelDir = join(PROJECT_ROOT, "web", ".vercel");
  if (existsSync(vercelDir)) {
    const targetVercel = join(worktreePath, "web", ".vercel");
    mkdirSync(join(worktreePath, "web"), { recursive: true });
    cpSync(vercelDir, targetVercel, { recursive: true });
    info("已复制 web/.vercel");
  }

  // Copy claude settings
  const claudeSettings = join(PROJECT_ROOT, ".claude", "settings.local.json");
  if (existsSync(claudeSettings)) {
    mkdirSync(join(worktreePath, ".claude"), { recursive: true });
    copyFileSync(claudeSettings, join(worktreePath, ".claude", "settings.local.json"));
    info("已复制 .claude/settings.local.json");
  }

  // Random ports
  const devPort = Math.floor(Math.random() * 5000) + 4000;
  const storybookPort = devPort + 1;
  const studioPort = devPort + 2;
  const inngestPort = devPort + 3;

  // Run wt-setup and wt-init
  info("初始化工作区环境...");
  const env = {
    ...process.env,
    WT_DEV_PORT: String(devPort),
    WT_SB_PORT: String(storybookPort),
    WT_STUDIO_PORT: String(studioPort),
    WT_INNGEST_PORT: String(inngestPort),
    WT_BASE_BRANCH: baseBranch,
  };
  execInherit(`node "${join(PROJECT_ROOT, "scripts", "wt-setup.mjs")}" "${worktreePath}"`, { env });
  execInherit(`node "${join(PROJECT_ROOT, "scripts", "wt-init.mjs")}" "${worktreePath}"`);
  success("工作区环境初始化完成");

  // Generate CLAUDE.local.md from template
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const tplFile = join(scriptDir, "..", "claude-local.tpl");
  if (existsSync(tplFile)) {
    let tpl = readFileSync(tplFile, "utf-8");
    tpl = tpl.replaceAll("{{WORKTREE_PATH}}", worktreePath);
    tpl = tpl.replaceAll("{{DEV_PORT}}", String(devPort));
    tpl = tpl.replaceAll("{{STORYBOOK_PORT}}", String(storybookPort));
    tpl = tpl.replaceAll("{{STUDIO_PORT}}", String(studioPort));
    tpl = tpl.replaceAll("{{INNGEST_PORT}}", String(inngestPort));
    writeFileSync(join(worktreePath, "CLAUDE.local.md"), tpl);
    info(`已生成 CLAUDE.local.md (dev=${devPort})`);
  }

  // Copy init/cleanup scripts
  const wtConfigDir = join(worktreePath, ".worktree");
  const initScript = join(WORKTREE_CONFIG_DIR, "init.sh");
  const cleanupScript = join(WORKTREE_CONFIG_DIR, "cleanup.sh");
  if (existsSync(initScript)) {
    copyFileSync(initScript, join(wtConfigDir, "init.sh"));
    chmodSync(join(wtConfigDir, "init.sh"), 0o755);
  }
  if (existsSync(cleanupScript)) {
    copyFileSync(cleanupScript, join(wtConfigDir, "cleanup.sh"));
    chmodSync(join(wtConfigDir, "cleanup.sh"), 0o755);
  }

  // Run init.sh
  if (existsSync(join(wtConfigDir, "init.sh"))) {
    info("执行初始化脚本...");
    execInherit(`bash "${join(wtConfigDir, "init.sh")}"`, { cwd: worktreePath });
    success("初始化完成");
  }

  linkAutoMemory(worktreePath);

  console.log("");
  console.log("==========================================");
  console.log("Worktree 就绪");
  console.log(`路径: ${worktreePath}`);
  console.log(`分支: ${fullBranch}`);
  console.log("");
  console.log("下一步:");
  console.log(`  cd ${worktreePath}`);
  console.log("  code .");
  console.log("==========================================");
}
