/**
 * Migration script: convert x-enumDatasetId to template enum strings.
 *
 * For each schema in the database, recursively finds `x-enumDatasetId` fields
 * and replaces them with `"enum": ["{{dataset_key}}"]` where dataset_key is
 * resolved from the dataset UUID.
 *
 * Usage: npx tsx src/scripts/migrate-enum-template.ts
 */

import { db } from "@/db";
import { schemas, datasets } from "@/db/schema";
import { isNull } from "drizzle-orm";

interface JsonSchema7WithLegacy {
  type?: string | string[];
  properties?: Record<string, JsonSchema7WithLegacy>;
  items?: JsonSchema7WithLegacy | JsonSchema7WithLegacy[];
  additionalProperties?: boolean | JsonSchema7WithLegacy;
  oneOf?: JsonSchema7WithLegacy[];
  anyOf?: JsonSchema7WithLegacy[];
  allOf?: JsonSchema7WithLegacy[];
  prefixItems?: JsonSchema7WithLegacy[];
  $defs?: Record<string, JsonSchema7WithLegacy>;
  enum?: unknown[];
  "x-enumDatasetId"?: string;
  [key: string]: unknown;
}

function migrateSchema(
  schema: JsonSchema7WithLegacy,
  datasetIdToKey: Map<string, string>
): { changed: boolean; schema: JsonSchema7WithLegacy } {
  let changed = false;
  const result = { ...schema };

  // Convert x-enumDatasetId to template enum
  if (result["x-enumDatasetId"]) {
    const datasetKey = datasetIdToKey.get(result["x-enumDatasetId"]);
    if (datasetKey) {
      result.enum = [`{{${datasetKey}}}`];
      changed = true;
    }
    delete result["x-enumDatasetId"];
    changed = true;
  }

  // Recurse into properties
  if (result.properties) {
    const newProps: Record<string, JsonSchema7WithLegacy> = {};
    for (const [key, propSchema] of Object.entries(result.properties)) {
      const migrated = migrateSchema(propSchema, datasetIdToKey);
      newProps[key] = migrated.schema;
      if (migrated.changed) changed = true;
    }
    result.properties = newProps;
  }

  // Recurse into items
  if (result.items && typeof result.items === "object" && !Array.isArray(result.items)) {
    const migrated = migrateSchema(result.items, datasetIdToKey);
    result.items = migrated.schema;
    if (migrated.changed) changed = true;
  }

  // Recurse into additionalProperties
  if (result.additionalProperties && typeof result.additionalProperties === "object") {
    const migrated = migrateSchema(result.additionalProperties as JsonSchema7WithLegacy, datasetIdToKey);
    result.additionalProperties = migrated.schema;
    if (migrated.changed) changed = true;
  }

  // Recurse into oneOf/anyOf/allOf
  for (const key of ["oneOf", "anyOf", "allOf", "prefixItems"] as const) {
    if (result[key]) {
      const items = result[key] as JsonSchema7WithLegacy[];
      result[key] = items.map((s) => {
        const migrated = migrateSchema(s, datasetIdToKey);
        if (migrated.changed) changed = true;
        return migrated.schema;
      });
    }
  }

  // Recurse into $defs
  if (result.$defs) {
    const newDefs: Record<string, JsonSchema7WithLegacy> = {};
    for (const [key, defSchema] of Object.entries(result.$defs)) {
      const migrated = migrateSchema(defSchema, datasetIdToKey);
      newDefs[key] = migrated.schema;
      if (migrated.changed) changed = true;
    }
    result.$defs = newDefs;
  }

  return { changed, schema: result };
}

async function main() {
  console.log("Starting x-enumDatasetId → template enum migration...");

  // Load all datasets to build UUID → key mapping
  const allDatasets = await db
    .select({ id: datasets.id, key: datasets.key })
    .from(datasets)
    .where(isNull(datasets.deletedAt));

  const datasetIdToKey = new Map(allDatasets.map((d) => [d.id, d.key]));
  console.log(`Found ${allDatasets.length} datasets`);

  // Load all schemas
  const allSchemas = await db
    .select()
    .from(schemas)
    .where(isNull(schemas.deletedAt));

  console.log(`Found ${allSchemas.length} schemas`);

  let migratedCount = 0;
  for (const row of allSchemas) {
    const { changed, schema: migratedParams } = migrateSchema(
      row.parameters as JsonSchema7WithLegacy,
      datasetIdToKey
    );

    if (changed) {
      await db
        .update(schemas)
        .set({ parameters: migratedParams as Record<string, unknown> })
        .where(isNull(schemas.deletedAt));
      migratedCount++;
      console.log(`  Migrated: ${row.key} (${row.id})`);
    }
  }

  console.log(`\nDone. Migrated ${migratedCount} / ${allSchemas.length} schemas.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
