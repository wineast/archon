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
