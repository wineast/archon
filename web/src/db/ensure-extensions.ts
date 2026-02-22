import { createClient } from "./client";

async function main() {
  const sql = createClient();

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("✓ pgvector extension ensured");

  // HNSW index — skip if memories table doesn't exist yet (e.g. during db-reset before push)
  const [{ exists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'memories'
    )
  `;
  if (exists) {
    await sql`
      CREATE INDEX IF NOT EXISTS memories_embedding_idx
        ON memories USING hnsw (embedding vector_cosine_ops)
    `;
    console.log("✓ HNSW index ensured");
  } else {
    console.log("⏭ memories table not found, skipping HNSW index");
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
