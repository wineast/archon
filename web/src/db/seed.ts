import { join } from "path";
import { withClient, logSection, type SeedDb } from "./seed-utils";
import { pipeline } from "./seeders";
import type { SeedContext, SeedResult } from "./seeders/types";

// Re-export for consumers (e.g. tests)
export type { SeedResult } from "./seeders/types";

// ── seed ──

export async function seed(db?: SeedDb): Promise<SeedResult> {
  const run = async (database: SeedDb) => {
    const ctx: SeedContext = {
      db: database,
      agentId: "",
      agentDir: join(__dirname, "seed-data/gmcc-advisor"),
      componentKeyToId: {},
      toolNameToId: {},
      datasetKeyToId: {},
      ids: {
        toolIds: [],
        schemaIds: [],
        modelConfigIds: [],
        chatConfigId: "",
        datasetIds: [],
        functionIds: [],
        evalJudgeConfigId: "",
        evalCaseIds: [],
      },
    };

    for (const seeder of pipeline) {
      await seeder.run(ctx);
    }

    logSection("Seed complete");

    return {
      agentId: ctx.agentId,
      ...ctx.ids,
    };
  };

  if (db) return run(db);
  return withClient(run);
}

// ── CLI entry point ──

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("/seed.ts") || process.argv[1].endsWith("/seed.js"));

if (isDirectRun) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
