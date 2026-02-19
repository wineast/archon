import { z } from "zod";
import type { SchemaProperty } from "./types";

export interface BuildSchemaOptions {
  /** Datasets by UUID: id → resolved data. */
  datasetsById?: Record<string, unknown>;
  /** Schema map: schema UUID → resolved SchemaProperty[]. */
  schemaMap?: Record<string, SchemaProperty[]>;
}

/**
 * Build a zod schema for a single SchemaProperty.
 *
 * `ancestorSchemaIds` tracks schemaId references up the call stack to detect
 * self-referencing object types and generate z.lazy() for recursion.
 */
function buildParamSchema(
  param: SchemaProperty,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorSchemaIds?: Set<string>
): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (param.type) {
    case "number": {
      schema = param.integer ? z.number().int() : z.number();
      if (param.minimum != null) schema = (schema as z.ZodNumber).min(param.minimum);
      if (param.maximum != null) schema = (schema as z.ZodNumber).max(param.maximum);
      if (param.exclusiveMinimum != null) schema = (schema as z.ZodNumber).gt(param.exclusiveMinimum);
      if (param.exclusiveMaximum != null) schema = (schema as z.ZodNumber).lt(param.exclusiveMaximum);
      if (param.multipleOf != null) schema = (schema as z.ZodNumber).multipleOf(param.multipleOf);
      break;
    }
    case "boolean":
      schema = z.boolean();
      break;
    case "object":
      schema = buildObjectSchema(param, resolvedVars, options, ancestorSchemaIds);
      break;
    case "array": {
      let itemSchema: z.ZodTypeAny = z.unknown();
      if (param.items) {
        itemSchema = buildParamSchema(param.items, resolvedVars, options, ancestorSchemaIds);
      }
      schema = z.array(itemSchema);
      if (param.minItems != null) schema = (schema as z.ZodArray<z.ZodTypeAny>).min(param.minItems);
      if (param.maxItems != null) schema = (schema as z.ZodArray<z.ZodTypeAny>).max(param.maxItems);
      if (param.uniqueItems) {
        schema = (schema as z.ZodArray<z.ZodTypeAny>).refine(
          (arr) => new Set(arr.map((v) => JSON.stringify(v))).size === arr.length,
          { message: "Array items must be unique" }
        );
      }
      break;
    }
    case "enum": {
      // Resolve enumRef → actual enum values from datasets
      const resolvedEnum = resolveEnumValues(param, resolvedVars, options);
      if (resolvedEnum && resolvedEnum.length > 0) {
        schema = z.enum(resolvedEnum as [string, ...string[]]);
      } else {
        console.warn(`[schema-builder] enum param "${param.name}" has no values, falling back to z.string()`);
        schema = z.string();
      }
      break;
    }
    case "union": {
      schema = buildUnionSchema(param, resolvedVars, options, ancestorSchemaIds);
      break;
    }
    default: {
      // string
      schema = z.string();
      if (param.minLength != null) schema = (schema as z.ZodString).min(param.minLength);
      if (param.maxLength != null) schema = (schema as z.ZodString).max(param.maxLength);
      if (param.pattern) schema = (schema as z.ZodString).regex(new RegExp(param.pattern));
      if (param.format === "email") schema = (schema as z.ZodString).email();
      if (param.format === "url") schema = (schema as z.ZodString).url();
      if (param.format === "uuid") schema = (schema as z.ZodString).uuid();
      if (param.format === "date") schema = (schema as z.ZodString).date();
      if (param.format === "date-time") schema = (schema as z.ZodString).datetime();
      break;
    }
  }

  return schema;
}

/** Build z.object schema for "object" type params, with Map/Record and recursive ref support. */
function buildObjectSchema(
  param: SchemaProperty,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorSchemaIds?: Set<string>
): z.ZodTypeAny {
  // --- Recursive self-reference via schemaId ---
  if (param.schemaId && options?.schemaMap?.[param.schemaId]) {
    if (ancestorSchemaIds?.has(param.schemaId)) {
      // Self-reference detected → z.lazy() to break recursion
      return z.lazy(() =>
        buildObjectSchema(
          { ...param },
          resolvedVars,
          options,
          new Set() // fresh set — z.lazy defers, so no infinite loop
        )
      );
    }

    const nextAncestors = new Set(ancestorSchemaIds);
    nextAncestors.add(param.schemaId);

    const refParams = options.schemaMap[param.schemaId];
    const obj = buildNestedObject(refParams, resolvedVars, options, nextAncestors);

    // additionalProperties on top of referenced schema
    if (param.additionalProperties) {
      const valSchema = buildParamSchema(param.additionalProperties, resolvedVars, options, nextAncestors);
      return obj.catchall(valSchema);
    }
    return obj;
  }

  // --- Inline properties ---
  if (param.properties && param.properties.length > 0) {
    const obj = buildNestedObject(param.properties, resolvedVars, options, ancestorSchemaIds);
    // Fixed properties + additionalProperties → catchall
    if (param.additionalProperties) {
      const valSchema = buildParamSchema(param.additionalProperties, resolvedVars, options, ancestorSchemaIds);
      return obj.catchall(valSchema);
    }
    return obj;
  }

  // --- Pure Map/Record: no fixed properties, only additionalProperties ---
  if (param.additionalProperties) {
    const valSchema = buildParamSchema(param.additionalProperties, resolvedVars, options, ancestorSchemaIds);
    return z.record(z.string(), valSchema);
  }

  return z.unknown();
}

/** Build z.object from a list of child properties. */
function buildNestedObject(
  children: SchemaProperty[],
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorSchemaIds?: Set<string>
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const nested: Record<string, z.ZodTypeAny> = {};
  for (const child of children) {
    let childSchema = buildParamSchema(child, resolvedVars, options, ancestorSchemaIds);
    if (child.description) {
      childSchema = childSchema.describe(child.description);
    }
    if (!child.required) {
      if (child.defaultValue !== undefined) {
        childSchema = childSchema.default(child.defaultValue);
      } else {
        childSchema = childSchema.optional();
      }
    }
    nested[child.name] = childSchema;
  }
  return z.object(nested);
}

/** Build z.discriminatedUnion or z.union for "union" type params. */
function buildUnionSchema(
  param: SchemaProperty,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorSchemaIds?: Set<string>
): z.ZodTypeAny {
  if (!param.variants || param.variants.length < 2) {
    console.warn(`[schema-builder] union param "${param.name}" needs ≥2 variants, falling back to z.unknown()`);
    return z.unknown();
  }

  const variantSchemas = param.variants.map((variantProps) =>
    buildNestedObject(variantProps, resolvedVars, options, ancestorSchemaIds)
  );

  // discriminatedUnion requires a discriminator key present as z.literal in each variant
  if (param.discriminator) {
    return z.discriminatedUnion(
      param.discriminator,
      variantSchemas as [
        z.ZodObject<Record<string, z.ZodTypeAny>>,
        z.ZodObject<Record<string, z.ZodTypeAny>>,
        ...z.ZodObject<Record<string, z.ZodTypeAny>>[],
      ]
    );
  }

  // Fallback: plain union
  return z.union(
    variantSchemas as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
  );
}

/** Resolve enum values from datasets / resolvedVars / inline enum. */
function resolveEnumValues(
  param: SchemaProperty,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions
): string[] | undefined {
  // 1. enumDatasetId → from datasetsById (by UUID)
  if (param.enumDatasetId && options?.datasetsById?.[param.enumDatasetId] != null) {
    const val = options.datasetsById[param.enumDatasetId];
    const resolved = resolveEnumFromValue(val);
    if (resolved) return resolved;
  }

  // 2. enumRef → from resolvedVars (by key, backward compat)
  if (param.enumRef && resolvedVars?.[param.enumRef] != null) {
    const val = resolvedVars[param.enumRef];
    const resolved = resolveEnumFromValue(val);
    if (resolved) return resolved;
  }

  return param.enum;
}

/** Extract enum values from a resolved dataset value. */
function resolveEnumFromValue(val: unknown): string[] | undefined {
  if (Array.isArray(val)) {
    return val.map(String);
  } else if (typeof val === "object" && val !== null) {
    const values = Object.values(val as Record<string, unknown>);
    if (values.length > 0 && typeof values[0] === "string") {
      return values.map(String);
    } else {
      return Object.keys(val as Record<string, unknown>);
    }
  }
  return undefined;
}

/**
 * Build a zod object schema from a list of SchemaProperty definitions.
 * Returns z.object({}) when parameters is empty (no-arg tool).
 *
 * When `options.datasetsById` is provided, `enumDatasetId` on a parameter
 * resolves to the dataset's values. For object-type datasets with string
 * values, uses Object.values(); for arrays, uses array elements; for
 * objects with non-string values, uses Object.keys().
 */
export function buildInputSchema(
  parameters: SchemaProperty[],
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of parameters) {
    let schema = buildParamSchema(param, resolvedVars, options);

    if (param.description) {
      schema = schema.describe(param.description);
    }

    if (!param.required) {
      if (param.defaultValue !== undefined) {
        schema = schema.default(param.defaultValue);
      } else {
        schema = schema.optional();
      }
    }

    shape[param.name] = schema;
  }

  return z.object(shape);
}
