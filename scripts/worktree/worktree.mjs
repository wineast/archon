#!/usr/bin/env node
/**
 * Git Worktree 管理脚本
 * 用法: node scripts/worktree.mjs [list|create|delete|merge|sync] [args]
 */

import { cmdList } from "./cmd/list.mjs";
import { cmdCreate } from "./cmd/create.mjs";
import { cmdDelete } from "./cmd/delete.mjs";
import { cmdMerge } from "./cmd/merge.mjs";
import { cmdSync } from "./cmd/sync.mjs";
import { error } from "./cmd/_helpers.mjs";

function cmdHelp() {
  console.log("");
  console.log("Git Worktree 管理");
  console.log("================");
  console.log("");
  console.log("用法: node scripts/worktree.mjs <command> [args]");
  console.log("");
  console.log("命令:");
  console.log("  list                       列出所有 worktree");
  console.log("  create <name> [base]       创建新 worktree（可指定基础分支）");
  console.log("  sync                       同步上游分支到当前工作区");
  console.log("  merge <name>               合并工作区分支回 base 分支");
  console.log("  delete <name>              删除 worktree");
  console.log("  help                       显示帮助");
  console.log("");
  console.log("示例:");
  console.log("  node scripts/worktree.mjs list");
  console.log("  node scripts/worktree.mjs create feature-auth              # 基于当前分支");
  console.log("  node scripts/worktree.mjs create hotfix main               # 基于 main 分支");
  console.log("  node scripts/worktree.mjs delete feature-auth");
  console.log("");
}

const cmd = process.argv[2] || "help";
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (cmd) {
  case "list":
  case "ls":
    cmdList();
    break;
  case "create":
  case "new":
  case "add":
    cmdCreate(arg1, arg2);
    break;
  case "sync":
    cmdSync();
    break;
  case "merge":
    cmdMerge(arg1);
    break;
  case "delete":
  case "remove":
  case "rm":
    // cmdDelete is async (uses readline confirm)
    cmdDelete(arg1);
    break;
  case "help":
  case "--help":
  case "-h":
    cmdHelp();
    break;
  default:
    error(`未知命令: ${cmd}`);
    cmdHelp();
    process.exit(1);
}
