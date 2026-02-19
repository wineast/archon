/**
 * One-time migration: convert enumRef (string key) → enumDatasetId (UUID).
 *
 * Usage:
 *   npx tsx src/scripts/migrate-enumref.ts
 *
 * For each row in `schemas`, recursively walks `parameters` JSONB.
 * When a ToolParameter has `enumRef`, looks up the dataset by key,
 * replaces it with `enumDatasetId`, and removes the `enumRef` field.
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { schemas, datasets } from "../db/schema";
import type { SchemaProperty } from "../lib/schemas/types";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client });

interface LegacySchemaProperty extends SchemaProperty {
  enumRef?: string;
  properties?: LegacySchemaProperty[];
}

async function main() {
  console.log("Fetching all schemas...");
  const allSchemas = await db.select().from(schemas);
  console.log(`Found ${allSchemas.length} schema rows`);

  // Build dataset key → id map (across all agents)
  const allDatasets = await db
    .select({ id: datasets.id, key: datasets.key, agentId: datasets.agentId })
    .from(datasets);

  // Map: agentId:key → dataset id
  const datasetMap = new Map<string, string>();
  for (const ds of allDatasets) {
    datasetMap.set(`${ds.agentId}:${ds.key}`, ds.id);
  }
  console.log(`Built dataset map with ${datasetMap.size} entries`);

  let updatedRows = 0;
  let convertedFields = 0;

  for (const row of allSchemas) {
    const params = row.parameters as LegacySchemaProperty[];
    let changed = false;

    function walk(paramList: LegacySchemaProperty[]) {
      for (const p of paramList) {
        if (p.enumRef) {
          const dsId = datasetMap.get(`${row.agentId}:${p.enumRef}`);
          if (dsId) {
            p.enumDatasetId = dsId;
            console.log(`  [OK] ${row.key}.${p.name}: enumRef="${p.enumRef}" → enumDatasetId="${dsId}"`);
          } else {
            console.warn(`  [WARN] ${row.key}.${p.name}: enumRef="${p.enumRef}" — dataset not found, removing anyway`);
          }
          delete p.enumRef;
          changed = true;
          convertedFields++;
        }
        if (p.properties) {
          walk(p.properties);
        }
      }
    }

    walk(params);

    if (changed) {
      await db
        .update(schemas)
        .set({ parameters: params as SchemaProperty[] })
        .where(eq(schemas.id, row.id));
      updatedRows++;
    }
  }

  console.log(`\nDone. Updated ${updatedRows} rows, converted ${convertedFields} enumRef fields.`);
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
