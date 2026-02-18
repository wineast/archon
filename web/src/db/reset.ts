import { createClient } from "./client";

async function main() {
  const sql = createClient();

  console.log("Dropping all tables...");

  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `;

  console.log("All tables dropped.");
  await sql.end();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
