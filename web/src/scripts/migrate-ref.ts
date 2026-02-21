/**
 * One-time migration: convert x-schemaId / x-schemaIds / schema_includes → $ref / allOf.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-ref.ts
 *
 * Steps:
 * 1. Load all schemas + schema_includes
 * 2. For each schema:
 *    - x-schemaId → $ref: "#/$defs/{key}" (recursive walk)
 *    - x-schemaIds → allOf: [{$ref:...}, ...] (recursive walk)
 * 3. For each schema with includes:
 *    - Convert includes to top-level allOf entries
 * 4. Write back to DB
 * 5. Clear schema_includes table
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { schemas } from "../db/schema";
import type { JsonSchema7 } from "../lib/schemas/types";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacySchema = JsonSchema7 & { "x-schemaId"?: string; "x-schemaIds"?: string[]; [k: string]: any };

async function main() {
  console.log("Fetching all schemas...");
  const allSchemas = await db.select().from(schemas);
  console.log(`Found ${allSchemas.length} schema rows`);

  // Build schema UUID → key map
  const idToKey = new Map<string, string>();
  for (const row of allSchemas) {
    idToKey.set(row.id, row.key);
  }
  console.log(`Built id→key map with ${idToKey.size} entries`);

  // Load schema_includes (if table still exists)
  let includesRows: Array<{ schemaId: string; includeSchemaId: string }> = [];
  try {
    const result = await client`SELECT schema_id, include_schema_id FROM schema_includes`;
    includesRows = result.map((r) => ({
      schemaId: r.schema_id as string,
      includeSchemaId: r.include_schema_id as string,
    }));
    console.log(`Found ${includesRows.length} schema_includes rows`);
  } catch {
    console.log("schema_includes table not found or empty, skipping includes migration");
  }

  // Group includes by schemaId
  const includesBySchema = new Map<string, string[]>();
  for (const row of includesRows) {
    const list = includesBySchema.get(row.schemaId) ?? [];
    list.push(row.includeSchemaId);
    includesBySchema.set(row.schemaId, list);
  }

  let updatedRows = 0;
  let convertedXSchemaId = 0;
  let convertedXSchemaIds = 0;
  let convertedIncludes = 0;

  for (const row of allSchemas) {
    const params = structuredClone(row.parameters) as LegacySchema;
    let changed = false;

    // --- Walk the schema tree and replace x-schemaId / x-schemaIds ---
    function walk(schema: LegacySchema, path: string): LegacySchema {
      // x-schemaId → $ref
      if (schema["x-schemaId"]) {
        const uuid = schema["x-schemaId"];
        const key = idToKey.get(uuid);
        if (key) {
          console.log(`  [OK] ${row.key}.${path}: x-schemaId="${uuid}" → $ref="#/$defs/${key}"`);
          delete schema["x-schemaId"];
          // Remove type:"object" if it was just a reference wrapper
          if (schema.type === "object" && !schema.properties) {
            delete schema.type;
          }
          schema.$ref = `#/$defs/${key}`;
          changed = true;
          convertedXSchemaId++;
        } else {
          console.warn(`  [WARN] ${row.key}.${path}: x-schemaId="${uuid}" — schema not found, removing`);
          delete schema["x-schemaId"];
          changed = true;
        }
      }

      // x-schemaIds → allOf
      if (schema["x-schemaIds"] && schema["x-schemaIds"].length > 0) {
        const uuids = schema["x-schemaIds"];
        const refs: JsonSchema7[] = [];
        for (const uuid of uuids) {
          const key = idToKey.get(uuid);
          if (key) {
            refs.push({ $ref: `#/$defs/${key}` });
            console.log(`  [OK] ${row.key}.${path}: x-schemaIds item "${uuid}" → $ref="#/$defs/${key}"`);
          } else {
            console.warn(`  [WARN] ${row.key}.${path}: x-schemaIds item "${uuid}" — schema not found, skipping`);
          }
        }
        delete schema["x-schemaIds"];
        if (schema.type === "object" && !schema.properties) {
          delete schema.type;
        }
        if (refs.length > 0) {
          schema.allOf = [...(schema.allOf ?? []), ...refs];
        }
        changed = true;
        convertedXSchemaIds++;
      }

      // Recurse into properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          schema.properties[key] = walk(propSchema as LegacySchema, `${path}.${key}`);
        }
      }

      // Recurse into items
      if (schema.items && !Array.isArray(schema.items)) {
        schema.items = walk(schema.items as LegacySchema, `${path}.items`);
      }

      // Recurse into oneOf/anyOf/allOf
      if (schema.oneOf) {
        schema.oneOf = schema.oneOf.map((s, i) => walk(s as LegacySchema, `${path}.oneOf[${i}]`));
      }
      if (schema.anyOf) {
        schema.anyOf = schema.anyOf.map((s, i) => walk(s as LegacySchema, `${path}.anyOf[${i}]`));
      }
      if (schema.allOf) {
        schema.allOf = schema.allOf.map((s, i) => walk(s as LegacySchema, `${path}.allOf[${i}]`));
      }

      // Recurse into additionalProperties
      if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        schema.additionalProperties = walk(schema.additionalProperties as LegacySchema, `${path}.additionalProperties`);
      }

      // Remove x-source (only used by old resolveSchema preview)
      if ("x-source" in schema) {
        delete schema["x-source"];
        changed = true;
      }

      return schema;
    }

    walk(params, "root");

    // --- Convert schema_includes to top-level allOf ---
    const includes = includesBySchema.get(row.id);
    if (includes && includes.length > 0) {
      const refs: JsonSchema7[] = [];
      for (const includeId of includes) {
        const key = idToKey.get(includeId);
        if (key) {
          refs.push({ $ref: `#/$defs/${key}` });
          console.log(`  [OK] ${row.key}: include "${includeId}" → allOf $ref="#/$defs/${key}"`);
        } else {
          console.warn(`  [WARN] ${row.key}: include "${includeId}" — schema not found, skipping`);
        }
      }
      if (refs.length > 0) {
        params.allOf = [...(params.allOf ?? []), ...refs];
        changed = true;
        convertedIncludes += refs.length;
      }
    }

    if (changed) {
      await db
        .update(schemas)
        .set({ parameters: params as JsonSchema7 })
        .where(eq(schemas.id, row.id));
      updatedRows++;
    }
  }

  // Clear schema_includes table
  if (includesRows.length > 0) {
    try {
      await client`DELETE FROM schema_includes`;
      console.log("\nCleared schema_includes table");
    } catch {
      console.log("\nschema_includes table already gone");
    }
  }

  console.log(`\nDone.`);
  console.log(`  Updated ${updatedRows} schema rows`);
  console.log(`  Converted ${convertedXSchemaId} x-schemaId → $ref`);
  console.log(`  Converted ${convertedXSchemaIds} x-schemaIds → allOf`);
  console.log(`  Converted ${convertedIncludes} includes → allOf`);
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
