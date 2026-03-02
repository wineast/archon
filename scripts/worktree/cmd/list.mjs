#!/usr/bin/env node
/**
 * 命令: list — 列出所有 worktree
 */

import { existsSync, readdirSync } from "node:fs";
import { exec, WORKTREES_DIR } from "./_helpers.mjs";

export function cmdList() {
  console.log("");
  console.log("Git Worktrees:");
  console.log("==============");
  console.log(exec("git worktree list"));
  console.log("");

  if (existsSync(WORKTREES_DIR)) {
    console.log(".worktrees/ 目录内容:");
    console.log("======================");
    try {
      const entries = readdirSync(WORKTREES_DIR);
      if (entries.length === 0) {
        console.log("(空)");
      } else {
        for (const entry of entries) {
          console.log(`  ${entry}`);
        }
      }
    } catch {
      console.log("(空)");
    }
    console.log("");
  }
}
