#!/usr/bin/env node
/**
 * 工作区数据清理（wt-init 的反向操作）
 * 用法: node scripts/wt-fini.mjs [target_dir]
 *
 * 流程: 删数据库
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, basename, join } from "node:path";

const targetDir = resolve(process.argv[2] || ".");

const CONTAINER = "archon-postgres";
const DB_USER = "archon";
const DEFAULT_DB = "archon";

console.log("🗄️  [wt-fini] 删除数据库...");

const metaPath = join(targetDir, ".worktree", "meta.json");
if (existsSync(metaPath)) {
  const wtName = basename(targetDir);
  const dbName = `archon_${wtName.replace(/-/g, "_")}`;

  // Check if database exists
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

  if (dbExists) {
    // Terminate active connections
    try {
      execSync(
        `docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DEFAULT_DB} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();"`,
        { stdio: "ignore" }
      );
    } catch { /* ignore */ }

    execSync(`docker exec ${CONTAINER} dropdb -U ${DB_USER} ${dbName}`, { stdio: "inherit" });
    console.log(`  Dropped database: ${dbName}`);
  } else {
    console.log(`  Database ${dbName} does not exist`);
  }
}
