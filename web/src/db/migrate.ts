import { createClient } from "./client";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ensureExtensions } from "./ensure-extensions";

const INITIAL_MIGRATION = "0000_cynical_omega_red";

/**
 * Baseline：如果数据库已有表（之前通过 db-push 创建）但没有迁移记录，
 * 自动将初始迁移标记为已应用，避免重复建表报错。
 */
async function baselineIfNeeded(sql: ReturnType<typeof createClient>) {
  // 检查是否有业务表（用 agents 作为标志）
  const [{ exists: tablesExist }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'agents'
    )
  `;
  if (!tablesExist) return; // 空库，正常跑迁移即可

  // 确保 drizzle 迁移 schema 和 journal 表存在
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // 检查初始迁移是否已记录
  const [{ count }] = await sql`
    SELECT count(*)::int as count FROM drizzle."__drizzle_migrations"
    WHERE hash = ${INITIAL_MIGRATION}
  `;
  if (count > 0) return; // 已有记录，无需 baseline

  // 插入初始迁移记录（标记为已应用）
  await sql`
    INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
    VALUES (${INITIAL_MIGRATION}, ${Date.now()})
  `;
  console.log(`✓ Baseline: 初始迁移 ${INITIAL_MIGRATION} 已标记为已应用（表已存在）`);
}

async function main() {
  const sql = createClient();

  // 扩展必须在迁移前存在（vector 列类型依赖 pgvector）
  console.log("Ensuring extensions (pre-migrate)...");
  await ensureExtensions(sql);

  // Baseline：兼容之前通过 db-push 创建的生产库
  await baselineIfNeeded(sql);

  const db = drizzle({ client: sql });

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");

  // 迁移后确保 HNSW 索引存在
  console.log("Ensuring extensions (post-migrate)...");
  await ensureExtensions(sql);

  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
