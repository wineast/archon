import type { JsonSchema7, DisplayType } from "./types";
import { EMPTY_OBJECT_SCHEMA } from "./types";

/**
 * Infer the UI display type from a JSON Schema 7 object.
 */
export function getDisplayType(schema: JsonSchema7): DisplayType {
  // const takes precedence
  if (schema.const !== undefined) return "const";

  // union: oneOf or anyOf (but not nullable pattern)
  if (schema.oneOf && schema.oneOf.length > 0) return "union";
  if (schema.anyOf && schema.anyOf.length > 0) {
    // nullable pattern: anyOf: [T, {type:"null"}]
    if (isNullableSchema(schema)) {
      return getDisplayType(unwrapNullable(schema));
    }
    return "union";
  }

  // type-based
  const t = schema.type;
  if (t === "string") return "string";
  if (t === "integer") return "integer";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  if (t === "object") return "object";
  if (t === "array") return "array";
  if (t === "null") return "null";

  // Fallback
  return "string";
}

/**
 * Generate a new schema when the user switches display type in the UI.
 * Preserves description and x- extensions where possible.
 */
export function changeDisplayType(schema: JsonSchema7, newType: DisplayType): JsonSchema7 {
  // Preserve common fields + x- extensions
  const base: JsonSchema7 = {};
  if (schema.description) base.description = schema.description;
  for (const [k, v] of Object.entries(schema)) {
    if (k.startsWith("x-") && v !== undefined) {
      (base as Record<string, unknown>)[k] = v;
    }
  }

  switch (newType) {
    case "string":
      return { ...base, type: "string" };
    case "number":
      return { ...base, type: "number" };
    case "integer":
      return { ...base, type: "integer" };
    case "boolean":
      return { ...base, type: "boolean" };
    case "null":
      return { ...base, type: "null" };
    case "const":
      return { ...base, const: "" };
    case "object":
      return { ...base, type: "object", properties: {}, required: [] };
    case "array":
      return { ...base, type: "array", items: { type: "string" } };
    case "union":
      return {
        ...base,
        oneOf: [{ type: "string" }, { type: "number" }],
        "x-unionMode": "oneOf",
      };
    default:
      return { ...base, type: "string" };
  }
}

/**
 * Check if a schema uses the nullable pattern: `anyOf: [T, {type:"null"}]`.
 */
export function isNullableSchema(schema: JsonSchema7): boolean {
  if (!schema.anyOf || schema.anyOf.length !== 2) return false;
  return schema.anyOf.some((s) => s.type === "null");
}

/**
 * Unwrap nullable pattern, returning the non-null variant.
 * Returns the schema unchanged if it's not nullable.
 */
export function unwrapNullable(schema: JsonSchema7): JsonSchema7 {
  if (!isNullableSchema(schema)) return schema;
  const nonNull = schema.anyOf!.find((s) => s.type !== "null");
  if (!nonNull) return schema;
  // Restore outer description into inner schema
  if (schema.description && !nonNull.description) {
    return { ...nonNull, description: schema.description };
  }
  return nonNull;
}

/**
 * Wrap a schema with nullable pattern: `anyOf: [schema, {type:"null"}]`.
 * No-ops if already nullable.
 */
export function wrapNullable(schema: JsonSchema7): JsonSchema7 {
  if (isNullableSchema(schema)) return schema;
  const { description, ...rest } = schema;
  const wrapped: JsonSchema7 = { anyOf: [rest, { type: "null" }] };
  if (description) wrapped.description = description;
  return wrapped;
}

/**
 * Extract ordered property entries from a JSON Schema object.
 * Returns an array with key, schema, and required status for each property.
 */
export function getPropertyEntries(
  schema: JsonSchema7
): Array<{ key: string; schema: JsonSchema7; required: boolean }> {
  if (!schema.properties) return [];
  const requiredSet = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([key, propSchema]) => ({
    key,
    schema: propSchema,
    required: requiredSet.has(key),
  }));
}

/**
 * Check if a property key is in the parent schema's required array.
 */
export function isPropertyRequired(parentSchema: JsonSchema7, key: string): boolean {
  return parentSchema.required?.includes(key) ?? false;
}

export { EMPTY_OBJECT_SCHEMA };
