import { join } from "path";
import { readdirSync, existsSync } from "fs";
import { withClient, logSection, type SeedDb } from "./seed-utils";
import { globalPipeline, agentPipeline } from "./seeders";
import type { SeedContext, SeedResult } from "./seeders/types";

// Re-export for consumers (e.g. tests)
export type { SeedResult } from "./seeders/types";

// ── Discover agent directories ──

function discoverAgentDirs(seedDataDir: string): string[] {
  return readdirSync(seedDataDir, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && existsSync(join(seedDataDir, d.name, "agent.json"))
    )
    .map((d) => join(seedDataDir, d.name));
}

// ── seed ──

export async function seed(db?: SeedDb): Promise<SeedResult> {
  const run = async (database: SeedDb) => {
    // ── Phase 1: Global seeders (run once) ──
    const globalCtx: SeedContext = {
      db: database,
      orgId: "",
      agentId: "",
      versionId: "",
      agentDir: "",
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
        judgeConfigId: "",
        evalCaseIds: [],
      },
    };

    for (const seeder of globalPipeline) {
      await seeder.run(globalCtx);
    }

    // ── Phase 2: Per-agent seeders ──
    const seedDataDir = join(__dirname, "seed-data");
    const agentDirs = discoverAgentDirs(seedDataDir);

    let firstResult: SeedResult | null = null;

    for (const agentDir of agentDirs) {
      const ctx: SeedContext = {
        db: database,
        orgId: globalCtx.orgId,
        agentId: "",
        versionId: "",
        agentDir,
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
          judgeConfigId: "",
          evalCaseIds: [],
        },
      };

      for (const step of agentPipeline) {
        if (step.requires && !existsSync(join(agentDir, step.requires))) {
          continue;
        }
        await step.seeder.run(ctx);
      }

      if (!firstResult) {
        firstResult = { agentId: ctx.agentId, ...ctx.ids };
      }
    }

    logSection("Seed complete");

    return firstResult!;
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
