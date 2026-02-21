import { db } from "@/db";
import { schemas } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { JsonSchema7 } from "./types";

/**
 * Extract the schema key from a `$ref` string.
 * e.g. `"#/$defs/pricing_engine_params"` → `"pricing_engine_params"`
 *
 * Returns `null` if the value is not a valid `$ref`.
 */
export function extractRefKey(schema: JsonSchema7 | null): string | null {
  if (!schema?.$ref) return null;
  const match = schema.$ref.match(/^#\/\$defs\/(.+)$/);
  return match?.[1] ?? null;
}

/**
 * Resolve an inline schema value:
 * - `null` → `null`
 * - `{ "$ref": "#/$defs/key" }` → looked up from `defsMap`
 * - anything else → returned as-is
 */
export function resolveInlineSchema(
  schema: JsonSchema7 | null,
  defsMap: Record<string, JsonSchema7>,
): JsonSchema7 | null {
  if (!schema) return null;
  const key = extractRefKey(schema);
  if (key) return defsMap[key] ?? null;
  return schema;
}

/**
 * Build a defsMap (key → JSON Schema) from the schemas table for a given agent.
 * Lightweight alternative to gatherTemplateData() when only defsMap is needed.
 */
export async function getDefsMap(
  agentId: string,
): Promise<Record<string, JsonSchema7>> {
  const rows = await db
    .select({ key: schemas.key, parameters: schemas.parameters })
    .from(schemas)
    .where(and(eq(schemas.agentId, agentId), isNull(schemas.deletedAt)));
  const map: Record<string, JsonSchema7> = {};
  for (const row of rows) {
    map[row.key] = row.parameters as JsonSchema7;
  }
  return map;
}

/**
 * Recursively expand all `$ref` references in a JSON Schema.
 *
 * - `{ "$ref": "#/$defs/key" }` → replaced with `defsMap[key]` (then recursed)
 * - `properties`, `items`, `allOf`, `anyOf`, `oneOf`, `additionalProperties`,
 *   `prefixItems` are all walked recursively
 * - Uses a `visited` set to detect circular references; cycles keep the original `$ref`
 */
export function expandSchemaRefs(
  schema: JsonSchema7,
  defsMap: Record<string, JsonSchema7>,
  visited: Set<string> = new Set(),
): JsonSchema7 {
  // Handle $ref at the current level
  const refKey = extractRefKey(schema);
  if (refKey) {
    if (visited.has(refKey)) return schema; // circular — keep $ref
    const resolved = defsMap[refKey];
    if (!resolved) return schema; // unknown ref — keep as-is
    return expandSchemaRefs(resolved, defsMap, new Set([...visited, refKey]));
  }

  const result: JsonSchema7 = { ...schema };

  // properties
  if (result.properties) {
    const expanded: Record<string, JsonSchema7> = {};
    for (const [k, v] of Object.entries(result.properties)) {
      expanded[k] = expandSchemaRefs(v, defsMap, visited);
    }
    result.properties = expanded;
  }

  // items (single schema or tuple)
  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map((s) => expandSchemaRefs(s, defsMap, visited));
    } else {
      result.items = expandSchemaRefs(result.items, defsMap, visited);
    }
  }

  // prefixItems
  if (result.prefixItems) {
    result.prefixItems = result.prefixItems.map((s) => expandSchemaRefs(s, defsMap, visited));
  }

  // additionalProperties (when it's a schema, not boolean)
  if (result.additionalProperties && typeof result.additionalProperties === "object") {
    result.additionalProperties = expandSchemaRefs(result.additionalProperties, defsMap, visited);
  }

  // composition keywords
  if (result.allOf) result.allOf = result.allOf.map((s) => expandSchemaRefs(s, defsMap, visited));
  if (result.anyOf) result.anyOf = result.anyOf.map((s) => expandSchemaRefs(s, defsMap, visited));
  if (result.oneOf) result.oneOf = result.oneOf.map((s) => expandSchemaRefs(s, defsMap, visited));

  // $defs (expand refs inside definitions too)
  if (result.$defs) {
    const expanded: Record<string, JsonSchema7> = {};
    for (const [k, v] of Object.entries(result.$defs)) {
      expanded[k] = expandSchemaRefs(v, defsMap, visited);
    }
    result.$defs = expanded;
  }

  return result;
}
