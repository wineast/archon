import { withClient, logSection, type SeedDb } from "./seed-utils";
import { pipeline } from "./seeders";
import type { SeedContext } from "./seeders/types";

// ── seed ──

export async function seed(db?: SeedDb): Promise<void> {
  const run = async (database: SeedDb) => {
    const ctx: SeedContext = { db: database };

    for (const seeder of pipeline) {
      await seeder.run(ctx);
    }

    logSection("Seed complete");
  };

  if (db) return run(db);
  return withClient(run);
}

// ── CLI entry point ──

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /[/\\]seed\.[tj]s$/.test(process.argv[1]);

if (isDirectRun) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
