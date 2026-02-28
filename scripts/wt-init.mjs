#!/usr/bin/env node
/**
 * 工作区数据初始化（推 schema + 灌种子）
 * 用法: node scripts/wt-init.mjs [target_dir]
 *
 * 流程: db-push → db-seed
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";

const targetDir = resolve(process.argv[2] || ".");
const webDir = resolve(targetDir, "web");

console.log("🗄️  [db-init] 推送 schema...");
execSync("npm run db:push", { stdio: "inherit", cwd: webDir });

console.log("🌱 [db-init] 灌入种子数据...");
execSync("npm run db:seed", { stdio: "inherit", cwd: webDir });
