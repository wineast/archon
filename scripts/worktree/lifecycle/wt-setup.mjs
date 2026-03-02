#!/usr/bin/env node
/**
 * 工作区静态环境初始化（供 make setup 和 worktree create 复用）
 * 用法: node scripts/wt-setup.mjs [target_dir]
 *
 * 环境变量（可选，用于 worktree 自定义端口）:
 *   WT_DEV_PORT, WT_SB_PORT, WT_STUDIO_PORT, WT_INNGEST_PORT, WT_BASE_BRANCH
 *
 * 流程: meta.json → link-env → db-local-env → npm install
 */

import { execSync } from "node:child_process";
import {
  existsSync, readFileSync, writeFileSync,
  mkdirSync, symlinkSync, copyFileSync, unlinkSync,
} from "node:fs";
import { resolve, basename, join } from "node:path";

const targetDir = resolve(process.argv[2] || ".");

// ── meta.json ────────────────────────────────────────────────

console.log("📦 [meta] 创建工作区元数据...");
const worktreeDir = join(targetDir, ".worktree");
mkdirSync(worktreeDir, { recursive: true });
const taskDir = join(targetDir, ".task");
mkdirSync(taskDir, { recursive: true });
const metaFile = join(worktreeDir, "meta.json");

const defDev = Number(process.env.WT_DEV_PORT) || 3000;
const defSb = Number(process.env.WT_SB_PORT) || 6006;
const defStudio = Number(process.env.WT_STUDIO_PORT) || 4983;
const defInngest = Number(process.env.WT_INNGEST_PORT) || 8288;
const defBase = process.env.WT_BASE_BRANCH || "main";

if (!existsSync(metaFile)) {
  const m = { dev: defDev, storybook: defSb, studio: defStudio, inngest: defInngest, baseBranch: defBase };
  writeFileSync(metaFile, JSON.stringify(m) + "\n");
  console.log(`  Created ${metaFile}`);
} else {
  const m = JSON.parse(readFileSync(metaFile, "utf-8"));
  const defaults = { dev: defDev, storybook: defSb, studio: defStudio, inngest: defInngest, baseBranch: defBase };
  const added = [];
  for (const [k, v] of Object.entries(defaults)) {
    if (m[k] === undefined) {
      m[k] = v;
      added.push(`${k}=${v}`);
    }
  }
  writeFileSync(metaFile, JSON.stringify(m) + "\n");
  if (added.length) {
    console.log(`  Patched: ${added.join(", ")}`);
  } else {
    console.log("  All fields present, no changes");
  }
}

// ── link-env ────────────────────────────────────────────────

console.log("🔗 [env] 配置环境变量...");
const vercelEnv = join(targetDir, "web", ".vercel", ".env.development.local");
if (existsSync(vercelEnv)) {
  const linkTarget = join(targetDir, "web", ".env.local");
  try { unlinkSync(linkTarget); } catch { /* not exists */ }
  symlinkSync(".vercel/.env.development.local", linkTarget);
  console.log(`  Linked ${linkTarget} → .vercel/.env.development.local`);
}

// ── e2e-env ────────────────────────────────────────────────

const projectRootForE2e = execSync("git worktree list --porcelain", { encoding: "utf-8" })
  .split("\n")[0]
  .replace("worktree ", "");
const sourceE2eEnv = join(projectRootForE2e, "web", "e2e", ".env");
const targetE2eEnv = join(targetDir, "web", "e2e", ".env");

if (existsSync(sourceE2eEnv) && !existsSync(targetE2eEnv)) {
  copyFileSync(sourceE2eEnv, targetE2eEnv);
  console.log("  Copied e2e/.env from main repo");
} else if (existsSync(targetE2eEnv)) {
  console.log("  e2e/.env already exists, skipping");
} else {
  console.log("  ⚠️  No e2e/.env found in main repo, E2E tests may fail");
}

// ── db-local-env ────────────────────────────────────────────

const CONTAINER = "archon-postgres";
const DB_USER = "archon";
const DEFAULT_DB = "archon";

let dbName;
if (existsSync(metaFile)) {
  const wtName = basename(targetDir);
  dbName = `archon_${wtName.replace(/-/g, "_")}`;
} else {
  dbName = DEFAULT_DB;
}

const dbUrl = `postgresql://${DB_USER}:${DB_USER}@localhost:5432/${dbName}`;

if (dbName !== DEFAULT_DB) {
  // Check if database exists, create if not
  let dbExists = false;
  try {
    const result = execSync(
      `docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DEFAULT_DB} -tc "SELECT 1 FROM pg_database WHERE datname = '${dbName}'"`,
      { encoding: "utf-8" }
    );
    dbExists = result.includes("1");
  } catch {
    dbExists = false;
  }

  if (!dbExists) {
    execSync(`docker exec ${CONTAINER} createdb -U ${DB_USER} ${dbName}`, { stdio: "inherit" });
    console.log(`  Created database: ${dbName}`);
  }
}

const targetEnv = join(targetDir, "web", ".env.development.local");
writeFileSync(targetEnv, `DATABASE_URL=${dbUrl}\nDATABASE_URL_UNPOOLED=${dbUrl}\n`);

// Inherit extra env vars from main repo
const projectRoot = execSync("git worktree list --porcelain", { encoding: "utf-8" })
  .split("\n")[0]
  .replace("worktree ", "");
const sourceEnv = join(projectRoot, "web", ".env.development.local");

if (existsSync(sourceEnv) && resolve(sourceEnv) !== resolve(targetEnv)) {
  const sourceContent = readFileSync(sourceEnv, "utf-8");
  const extraLines = sourceContent
    .split("\n")
    .filter((line) => !line.match(/^(DATABASE_URL|DATABASE_URL_UNPOOLED)=/) && line.trim() !== "")
    .join("\n");
  if (extraLines) {
    const existing = readFileSync(targetEnv, "utf-8");
    writeFileSync(targetEnv, existing + extraLines + "\n");
    console.log("  Inherited extra env vars from main repo");
  }
}

// Add INNGEST_DEV if port configured
if (existsSync(metaFile)) {
  try {
    const m = JSON.parse(readFileSync(metaFile, "utf-8"));
    if (m.inngest) {
      const existing = readFileSync(targetEnv, "utf-8");
      writeFileSync(targetEnv, existing + `INNGEST_DEV=http://127.0.0.1:${m.inngest}\n`);
      console.log(`  Added INNGEST_DEV → port ${m.inngest}`);
    }
  } catch { /* ignore */ }
}

console.log(`  Created web/.env.development.local → local DB (${dbName})`);

// ── deps ────────────────────────────────────────────────────

console.log("📥 [deps] 安装依赖...");
const installEnv = { ...process.env };
delete installEnv.NODE_ENV; // 确保安装 devDependencies（tsx、drizzle-kit 等）
execSync("npm install", { stdio: "inherit", cwd: join(targetDir, "web"), env: installEnv });
