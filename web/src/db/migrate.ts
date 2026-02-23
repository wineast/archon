import { createClient } from "./client";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ensureExtensions } from "./ensure-extensions";

async function main() {
  const sql = createClient();

  // Extensions must exist before migration (vector columns depend on pgvector)
  console.log("Ensuring extensions (pre-migrate)...");
  await ensureExtensions(sql);

  const db = drizzle({ client: sql });

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");

  // Ensure HNSW indexes after tables are created
  console.log("Ensuring extensions (post-migrate)...");
  await ensureExtensions(sql);

  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
