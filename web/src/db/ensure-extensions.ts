import { createClient } from "./client";

async function main() {
  const sql = createClient();

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("✓ pgvector extension ensured");

  // HNSW indexes — skip if tables don't exist yet (e.g. during db-reset before push)

  // memories table
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

  // rag_chunks: HNSW index requires fixed-dimension vectors.
  // Since rag_chunks uses dimensionless vector (varies by embedding model),
  // we skip HNSW here and rely on exact cosine distance search.
  // For large datasets, create a dimension-specific HNSW index manually.
  console.log("⏭ rag_chunks uses dimensionless vector, skipping HNSW index (exact search used)");

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
