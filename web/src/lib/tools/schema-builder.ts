import { z } from "zod";
import deepEqual from "fast-deep-equal";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { renderField } from "@/lib/datasets/queries";

export interface BuildSchemaOptions {
  /** Defs map: schema key → JsonSchema7 parameters. Used for $ref resolution. */
  defsMap?: Record<string, JsonSchema7>;
}

/**
 * Build a zod schema from a single JSON Schema 7 property.
 *
 * `ancestorKeys` tracks $ref schema keys up the call stack to detect
 * self-referencing object types and generate z.lazy() for recursion.
 */
function buildPropertySchema(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorKeys?: Set<string>
): z.ZodTypeAny {
  // $ref resolution
  if (schema.$ref) {
    return buildRefSchema(schema, resolvedVars, options, ancestorKeys);
  }

  // const
  if (schema.const !== undefined) {
    return z.literal(schema.const as string | number | boolean);
  }

  // nullable pattern: anyOf: [T, {type:"null"}]
  if (schema.anyOf && schema.anyOf.length === 2 && schema.anyOf.some((s) => s.type === "null")) {
    const nonNull = schema.anyOf.find((s) => s.type !== "null")!;
    return buildPropertySchema(nonNull, resolvedVars, options, ancestorKeys).nullable();
  }

  // union: oneOf / anyOf
  if (schema.oneOf && schema.oneOf.length >= 2) {
    return buildUnionSchema(schema, resolvedVars, options, ancestorKeys);
  }
  if (schema.anyOf && schema.anyOf.length >= 2) {
    return buildUnionSchema(schema, resolvedVars, options, ancestorKeys);
  }

  // allOf composition
  if (schema.allOf && schema.allOf.length > 0) {
    return buildAllOfSchema(schema, resolvedVars, options, ancestorKeys);
  }

  // enum
  if (schema.enum && schema.enum.length > 0) {
    const resolved = resolveEnumValues(schema, resolvedVars);
    if (resolved && resolved.length > 0) {
      return z.enum(resolved as [string, ...string[]]);
    }
    return z.string();
  }

  const t = schema.type;

  switch (t) {
    case "string": {
      let s: z.ZodTypeAny = z.string();
      if (schema.minLength != null) s = (s as z.ZodString).min(schema.minLength);
      if (schema.maxLength != null) s = (s as z.ZodString).max(schema.maxLength);
      if (schema.pattern) s = (s as z.ZodString).regex(new RegExp(schema.pattern));
      if (schema.format === "email") s = (s as z.ZodString).email();
      if (schema.format === "url") s = (s as z.ZodString).url();
      if (schema.format === "uuid") s = (s as z.ZodString).uuid();
      if (schema.format === "date") s = (s as z.ZodString).date();
      if (schema.format === "date-time") s = (s as z.ZodString).datetime();
      if (schema.format === "time") s = (s as z.ZodString).time();
      if (schema.format === "ipv4") s = (s as z.ZodString).ipv4();
      if (schema.format === "ipv6") s = (s as z.ZodString).ipv6();
      return s;
    }
    case "integer": {
      let s: z.ZodTypeAny = z.number().int();
      if (schema.minimum != null) s = (s as z.ZodNumber).min(schema.minimum);
      if (schema.maximum != null) s = (s as z.ZodNumber).max(schema.maximum);
      if (schema.exclusiveMinimum != null) s = (s as z.ZodNumber).gt(schema.exclusiveMinimum);
      if (schema.exclusiveMaximum != null) s = (s as z.ZodNumber).lt(schema.exclusiveMaximum);
      if (schema.multipleOf != null) s = (s as z.ZodNumber).multipleOf(schema.multipleOf);
      return s;
    }
    case "number": {
      let s: z.ZodTypeAny = z.number();
      if (schema.minimum != null) s = (s as z.ZodNumber).min(schema.minimum);
      if (schema.maximum != null) s = (s as z.ZodNumber).max(schema.maximum);
      if (schema.exclusiveMinimum != null) s = (s as z.ZodNumber).gt(schema.exclusiveMinimum);
      if (schema.exclusiveMaximum != null) s = (s as z.ZodNumber).lt(schema.exclusiveMaximum);
      if (schema.multipleOf != null) s = (s as z.ZodNumber).multipleOf(schema.multipleOf);
      return s;
    }
    case "boolean":
      return z.boolean();
    case "null":
      return z.null();
    case "object":
      return buildObjectSchema(schema, resolvedVars, options, ancestorKeys);
    case "array":
      return buildArraySchema(schema, resolvedVars, options, ancestorKeys);
    default:
      return z.unknown();
  }
}

/** Resolve a $ref to a schema key and build its Zod schema. */
function buildRefSchema(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorKeys?: Set<string>
): z.ZodTypeAny {
  const ref = schema.$ref;
  if (!ref) return z.unknown();

  const key = ref.replace("#/$defs/", "");
  const refSchema = options?.defsMap?.[key];
  if (!refSchema) return z.unknown();

  // Cycle detection — use z.lazy() for recursive refs
  if (ancestorKeys?.has(key)) {
    return z.lazy(() =>
      buildPropertySchema(refSchema, resolvedVars, options, new Set())
    );
  }

  const nextKeys = new Set(ancestorKeys);
  nextKeys.add(key);
  return buildPropertySchema(refSchema, resolvedVars, options, nextKeys);
}

/** Build z.object schema for allOf composition. Merges properties from all items. */
function buildAllOfSchema(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorKeys?: Set<string>
): z.ZodTypeAny {
  const mergedProps: Record<string, JsonSchema7> = {};
  const mergedRequired = new Set<string>();

  for (const item of schema.allOf ?? []) {
    // Resolve $ref items
    let resolved = item;
    if (item.$ref) {
      const key = item.$ref.replace("#/$defs/", "");
      const refSchema = options?.defsMap?.[key];
      if (refSchema) resolved = refSchema;
    }

    if (resolved.properties) {
      for (const [k, v] of Object.entries(resolved.properties)) {
        mergedProps[k] = v;
      }
    }
    for (const req of resolved.required ?? []) {
      mergedRequired.add(req);
    }
  }

  // Also merge in the schema's own properties (highest priority)
  if (schema.properties) {
    for (const [k, v] of Object.entries(schema.properties)) {
      mergedProps[k] = v;
    }
  }
  for (const req of schema.required ?? []) {
    mergedRequired.add(req);
  }

  if (Object.keys(mergedProps).length > 0) {
    const merged: JsonSchema7 = {
      type: "object",
      properties: mergedProps,
      required: Array.from(mergedRequired),
    };
    return buildNestedObject(merged, resolvedVars, options, ancestorKeys);
  }

  return z.unknown();
}

/** Build z.object schema for object-type schemas. */
function buildObjectSchema(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorKeys?: Set<string>
): z.ZodTypeAny {
  // --- Inline properties ---
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    let obj = buildNestedObject(schema, resolvedVars, options, ancestorKeys);
    if (schema.additionalProperties === true) {
      obj = obj.loose();
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      const valSchema = buildPropertySchema(schema.additionalProperties, resolvedVars, options, ancestorKeys);
      return obj.catchall(valSchema);
    }
    return obj;
  }

  // --- Pure Map/Record ---
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    const valSchema = buildPropertySchema(schema.additionalProperties, resolvedVars, options, ancestorKeys);
    return z.record(z.string(), valSchema);
  }

  return z.unknown();
}

/** Build z.object from a JSON Schema with properties/required. */
function buildNestedObject(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorKeys?: Set<string>
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const nested: Record<string, z.ZodTypeAny> = {};
  const requiredSet = new Set(schema.required ?? []);

  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    let zodSchema = buildPropertySchema(propSchema, resolvedVars, options, ancestorKeys);

    if (propSchema.description) {
      zodSchema = zodSchema.describe(propSchema.description);
    }

    if (!requiredSet.has(key)) {
      if (propSchema.default !== undefined) {
        zodSchema = zodSchema.default(propSchema.default);
      } else {
        zodSchema = zodSchema.optional();
      }
    }

    nested[key] = zodSchema;
  }

  return z.object(nested);
}

/** Build z.array from array-type schema. */
function buildArraySchema(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorKeys?: Set<string>
): z.ZodTypeAny {
  // Tuple
  if (schema.prefixItems && schema.prefixItems.length > 0) {
    const tupleSchemas = schema.prefixItems.map((item) =>
      buildPropertySchema(item, resolvedVars, options, ancestorKeys)
    );
    return z.tuple(tupleSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  // Regular array
  let itemSchema: z.ZodTypeAny = z.unknown();
  if (schema.items && !Array.isArray(schema.items)) {
    itemSchema = buildPropertySchema(schema.items, resolvedVars, options, ancestorKeys);
  }
  let result: z.ZodTypeAny = z.array(itemSchema);
  if (schema.minItems != null) result = (result as z.ZodArray<z.ZodTypeAny>).min(schema.minItems);
  if (schema.maxItems != null) result = (result as z.ZodArray<z.ZodTypeAny>).max(schema.maxItems);
  if (schema.uniqueItems) {
    result = (result as z.ZodArray<z.ZodTypeAny>).refine(
      (arr) => {
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            if (deepEqual(arr[i], arr[j])) return false;
          }
        }
        return true;
      },
      { message: "Array items must be unique" }
    );
  }
  return result;
}

/** Build z.discriminatedUnion or z.union from oneOf/anyOf. */
function buildUnionSchema(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions,
  ancestorKeys?: Set<string>
): z.ZodTypeAny {
  const unionMode = schema["x-unionMode"] ?? (schema.oneOf ? "oneOf" : "anyOf");
  const variants = (unionMode === "anyOf" ? schema.anyOf : schema.oneOf) ?? [];

  if (variants.length < 2) {
    return z.unknown();
  }

  const discriminator = schema["x-discriminator"];
  const discriminatorValues = schema["x-discriminatorValues"];

  const variantSchemas = variants.map((variant, i) => {
    let variantSchema: z.ZodTypeAny;

    if (variant.type === "object" || variant.properties) {
      variantSchema = buildObjectSchema(variant, resolvedVars, options, ancestorKeys);
    } else {
      variantSchema = buildPropertySchema(variant, resolvedVars, options, ancestorKeys);
    }

    // Inject discriminator literal
    const discValue = discriminator ? discriminatorValues?.[i] : undefined;
    if (discriminator && discValue && (variant.type === "object" || variant.properties)) {
      variantSchema = (variantSchema as z.ZodObject<Record<string, z.ZodTypeAny>>)
        .extend({ [discriminator]: z.literal(discValue) });
    }

    return variantSchema;
  });

  // anyOf → z.union
  if (unionMode === "anyOf") {
    return z.union(
      variantSchemas as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
    );
  }

  // oneOf + discriminator → z.discriminatedUnion
  if (discriminator) {
    return z.discriminatedUnion(
      discriminator,
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

/** Resolve enum values, expanding LiquidJS template strings from resolvedVars. */
function resolveEnumValues(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
): string[] | undefined {
  if (!schema.enum) return undefined;

  const result: string[] = [];
  for (const v of schema.enum) {
    const s = String(v);
    if (!resolvedVars || !s.includes("{{")) {
      result.push(s);
      continue;
    }
    const rendered = renderField(s, resolvedVars);
    // json filter outputs a JSON array string — parse and spread
    if (rendered.startsWith("[")) {
      try {
        const arr = JSON.parse(rendered);
        if (Array.isArray(arr)) {
          result.push(...arr.map(String));
          continue;
        }
      } catch { /* not valid JSON, fall through */ }
    }
    // Non-array result or parse failure — use as literal
    result.push(rendered);
  }
  return result;
}

/**
 * Build a zod object schema from a JSON Schema 7 object.
 * Returns z.object({}) when the schema has no properties (no-arg tool).
 */
export function buildInputSchema(
  schema: JsonSchema7,
  resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions
) {
  // Handle top-level allOf (e.g. from schema includes migration)
  if (schema.allOf && schema.allOf.length > 0) {
    const result = buildAllOfSchema(schema, resolvedVars, options);
    if (result instanceof z.ZodObject) return result;
    // Fallback if allOf didn't produce an object
  }

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return z.object({});
  }

  const obj = buildNestedObject(schema, resolvedVars, options);
  if (schema.additionalProperties === true) {
    return obj.loose();
  }
  return obj;
}
