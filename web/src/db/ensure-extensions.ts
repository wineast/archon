import type { Sql } from "postgres";
import { createClient } from "./client";

/**
 * 确保 PostgreSQL 扩展和索引存在。
 * 可被 migrate.ts 导入调用，也可作为独立脚本执行。
 */
export async function ensureExtensions(sql: Sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("✓ pgvector extension ensured");

  // HNSW 索引 —— 表不存在时跳过（如 db-reset 后 push 之前）

  // memories 表
  const [{ exists: memoriesExists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'memories'
    )
  `;
  if (memoriesExists) {
    await sql`
      CREATE INDEX IF NOT EXISTS memories_embedding_idx
        ON memories USING hnsw (embedding vector_cosine_ops)
    `;
    console.log("✓ HNSW index ensured (memories)");
  } else {
    console.log("⏭ memories table not found, skipping HNSW index");
  }

  // rag_chunks 使用无固定维度的 vector（随 embedding 模型变化），
  // HNSW 索引要求固定维度，因此跳过，运行时用精确余弦距离搜索。
  // 大数据量场景可手动创建指定维度的 HNSW 索引。
  console.log(
    "⏭ rag_chunks uses dimensionless vector, skipping HNSW index (exact search used)",
  );
}

// 独立 CLI 入口
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /[/\\]ensure-extensions\.[tj]s$/.test(process.argv[1]);

if (isDirectRun) {
  (async () => {
    const sql = createClient();
    await ensureExtensions(sql);
    await sql.end();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
