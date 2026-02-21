/**
 * One-time migration: convert enumRef (string key) → x-enumDatasetId (UUID).
 *
 * Usage:
 *   npx tsx src/scripts/migrate-enumref.ts
 *
 * For each row in `schemas`, recursively walks `parameters` JsonSchema7.
 * When a property has `enumRef`, looks up the dataset by key,
 * replaces it with `x-enumDatasetId`, and removes the `enumRef` field.
 *
 * @deprecated This migration is for legacy SchemaProperty → JsonSchema7 format.
 * It should only need to be run once during the migration period.
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { schemas, datasets } from "../db/schema";
import type { JsonSchema7 } from "../lib/schemas/types";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacySchema = JsonSchema7 & { enumRef?: string; [k: string]: any };

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
    const params = row.parameters as LegacySchema;
    let changed = false;

    function walk(schema: LegacySchema, path: string) {
      // Check this node for enumRef
      if (schema.enumRef) {
        const dsId = datasetMap.get(`${row.agentId}:${schema.enumRef}`);
        if (dsId) {
          schema["x-enumDatasetId"] = dsId;
          console.log(`  [OK] ${row.key}.${path}: enumRef="${schema.enumRef}" → x-enumDatasetId="${dsId}"`);
        } else {
          console.warn(`  [WARN] ${row.key}.${path}: enumRef="${schema.enumRef}" — dataset not found, removing anyway`);
        }
        delete schema.enumRef;
        changed = true;
        convertedFields++;
      }

      // Recurse into properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          walk(propSchema as LegacySchema, `${path}.${key}`);
        }
      }

      // Recurse into items
      if (schema.items && !Array.isArray(schema.items)) {
        walk(schema.items as LegacySchema, `${path}.items`);
      }
    }

    walk(params, "root");

    if (changed) {
      await db
        .update(schemas)
        .set({ parameters: params as JsonSchema7 })
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
