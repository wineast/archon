import { createClient } from "./client";

async function main() {
  const sql = createClient();

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("✓ pgvector extension ensured");

  await sql`
    CREATE INDEX IF NOT EXISTS memories_embedding_idx
      ON memories USING hnsw (embedding vector_cosine_ops)
  `;
  console.log("✓ HNSW index ensured");

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
