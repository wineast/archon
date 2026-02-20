import { z } from "zod";
import type { SchemaProperty } from "./types";

/** Recursively sort object keys for order-independent deep comparison. */
function stableStringify(val: unknown): string {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(stableStringify).join(",")}]`;
  const sorted = Object.keys(val as Record<string, unknown>).sort();
  return `{${sorted.map((k) => `${JSON.stringify(k)}:${stableStringify((val as Record<string, unknown>)[k])}`).join(",")}}`;
}

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
    case "null":
      schema = z.null();
      break;
    case "const":
      schema = param.constValue !== undefined ? z.literal(param.constValue as string | number | boolean) : z.unknown();
      break;
    case "object":
      schema = buildObjectSchema(param, resolvedVars, options, ancestorSchemaIds);
      break;
    case "array": {
      if (param.tuple && param.prefixItems && param.prefixItems.length > 0) {
        const tupleSchemas = param.prefixItems.map((item) =>
          buildParamSchema(item, resolvedVars, options, ancestorSchemaIds)
        );
        schema = z.tuple(tupleSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
      } else {
        let itemSchema: z.ZodTypeAny = z.unknown();
        if (param.items) {
          itemSchema = buildParamSchema(param.items, resolvedVars, options, ancestorSchemaIds);
        }
        schema = z.array(itemSchema);
        if (param.minItems != null) schema = (schema as z.ZodArray<z.ZodTypeAny>).min(param.minItems);
        if (param.maxItems != null) schema = (schema as z.ZodArray<z.ZodTypeAny>).max(param.maxItems);
        if (param.uniqueItems) {
          schema = (schema as z.ZodArray<z.ZodTypeAny>).refine(
            (arr) => new Set(arr.map(stableStringify)).size === arr.length,
            { message: "Array items must be unique" }
          );
        }
      }
      break;
    }
    case "enum": {
      // Resolve enum values from datasets or inline
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
      if (param.format === "time") schema = (schema as z.ZodString).time();
      if (param.format === "ipv4") schema = (schema as z.ZodString).ipv4();
      if (param.format === "ipv6") schema = (schema as z.ZodString).ipv6();
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

  // --- allOf: merge multiple schemas via schemaIds ---
  if (param.schemaIds && param.schemaIds.length > 0 && options?.schemaMap) {
    const mergedParams: SchemaProperty[] = [];
    const seen = new Set<string>();
    for (const sid of param.schemaIds) {
      const refParams = options.schemaMap[sid];
      if (refParams) {
        for (const p of refParams) {
          if (seen.has(p.name)) {
            const idx = mergedParams.findIndex((m) => m.name === p.name);
            if (idx >= 0) mergedParams[idx] = p;
          } else {
            seen.add(p.name);
            mergedParams.push(p);
          }
        }
      }
    }
    if (mergedParams.length > 0) {
      const obj = buildNestedObject(mergedParams, resolvedVars, options, ancestorSchemaIds);
      if (param.additionalProperties) {
        const valSchema = buildParamSchema(param.additionalProperties, resolvedVars, options, ancestorSchemaIds);
        return obj.catchall(valSchema);
      }
      return obj;
    }
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

  // Build variant schemas, injecting discriminator literal when discriminatorValues is provided
  const variantSchemas = param.variants.map((variantProps, i) => {
    const obj = buildNestedObject(variantProps, resolvedVars, options, ancestorSchemaIds);
    const discValue = param.discriminator && param.discriminatorValues?.[i];
    if (discValue != null) {
      return obj.extend({ [param.discriminator!]: z.literal(discValue) });
    }
    return obj;
  });

  // anyOf mode: always use z.union (anyOf semantics = try in order)
  if (param.unionMode === "anyOf") {
    return z.union(
      variantSchemas as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
    );
  }

  // oneOf (default): discriminatedUnion when discriminator is set
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

/** Resolve enum values from datasets / inline enum. */
function resolveEnumValues(
  param: SchemaProperty,
  _resolvedVars?: Record<string, unknown>,
  options?: BuildSchemaOptions
): string[] | undefined {
  // enumDatasetId → from datasetsById (by UUID)
  if (param.enumDatasetId && options?.datasetsById?.[param.enumDatasetId] != null) {
    const val = options.datasetsById[param.enumDatasetId];
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

/* ─────────── JSON Schema 7 generation ─────────── */

type JsonSchema7 = Record<string, unknown>;

/** Internal context threaded through JSON Schema builders. */
interface JsonSchemaCtx {
  options?: BuildSchemaOptions;
  ancestorSchemaIds: Set<string>;
  /** Collected $defs from schemaId references (populated during build). */
  $defs: Record<string, JsonSchema7>;
}

/** Build a single JSON Schema 7 property from a SchemaProperty. */
function buildJsonSchemaProperty(param: SchemaProperty, ctx: JsonSchemaCtx): JsonSchema7 {
  switch (param.type) {
    case "string": {
      const s: JsonSchema7 = { type: "string" };
      if (param.minLength != null) s.minLength = param.minLength;
      if (param.maxLength != null) s.maxLength = param.maxLength;
      if (param.pattern) s.pattern = param.pattern;
      if (param.format) s.format = param.format;
      if (param.defaultValue !== undefined) s.default = param.defaultValue;
      return s;
    }
    case "number": {
      const s: JsonSchema7 = { type: param.integer ? "integer" : "number" };
      if (param.minimum != null) s.minimum = param.minimum;
      if (param.maximum != null) s.maximum = param.maximum;
      if (param.exclusiveMinimum != null) s.exclusiveMinimum = param.exclusiveMinimum;
      if (param.exclusiveMaximum != null) s.exclusiveMaximum = param.exclusiveMaximum;
      if (param.multipleOf != null) s.multipleOf = param.multipleOf;
      if (param.defaultValue !== undefined) s.default = param.defaultValue;
      return s;
    }
    case "boolean": {
      const s: JsonSchema7 = { type: "boolean" };
      if (param.defaultValue !== undefined) s.default = param.defaultValue;
      return s;
    }
    case "null": {
      return { type: "null" };
    }
    case "const": {
      const s: JsonSchema7 = {};
      if (param.constValue !== undefined) s.const = param.constValue;
      return s;
    }
    case "enum": {
      const s: JsonSchema7 = { type: "string" };
      const resolved = resolveEnumValues(param, undefined, ctx.options);
      if (resolved && resolved.length > 0) {
        s.enum = resolved;
      }
      if (param.defaultValue !== undefined) s.default = param.defaultValue;
      return s;
    }
    case "object": {
      return buildJsonSchemaObject(param, ctx);
    }
    case "array": {
      const s: JsonSchema7 = { type: "array" };
      if (param.tuple && param.prefixItems && param.prefixItems.length > 0) {
        s.items = param.prefixItems.map((item) => buildJsonSchemaProperty(item, ctx));
      } else {
        if (param.items) {
          s.items = buildJsonSchemaProperty(param.items, ctx);
        }
        if (param.minItems != null) s.minItems = param.minItems;
        if (param.maxItems != null) s.maxItems = param.maxItems;
        if (param.uniqueItems != null) s.uniqueItems = param.uniqueItems;
      }
      if (param.defaultValue !== undefined) s.default = param.defaultValue;
      return s;
    }
    case "union": {
      return buildJsonSchemaUnion(param, ctx);
    }
    default:
      return { type: "string" };
  }
}

/** Build JSON Schema object from an object-type SchemaProperty, with schemaId/$ref, allOf, and additionalProperties support. */
function buildJsonSchemaObject(param: SchemaProperty, ctx: JsonSchemaCtx): JsonSchema7 {
  // --- allOf: merge multiple schemas via schemaIds ---
  if (param.schemaIds && param.schemaIds.length > 0 && ctx.options?.schemaMap) {
    const mergedChildren: SchemaProperty[] = [];
    const seen = new Set<string>();
    for (const sid of param.schemaIds) {
      const refParams = ctx.options.schemaMap[sid];
      if (refParams) {
        for (const p of refParams) {
          if (seen.has(p.name)) {
            const idx = mergedChildren.findIndex((m) => m.name === p.name);
            if (idx >= 0) mergedChildren[idx] = p;
          } else {
            seen.add(p.name);
            mergedChildren.push(p);
          }
        }
      }
    }
    if (mergedChildren.length > 0) {
      const obj = buildJsonSchemaNestedObject(mergedChildren, ctx);
      if (param.additionalProperties) {
        obj.additionalProperties = buildJsonSchemaProperty(param.additionalProperties, ctx);
      }
      if (param.defaultValue !== undefined) obj.default = param.defaultValue;
      return obj;
    }
  }

  // --- schemaId reference → $ref + $defs ---
  if (param.schemaId && ctx.options?.schemaMap?.[param.schemaId]) {
    // Recursive self-reference → just $ref (def is being built up the stack)
    if (ctx.ancestorSchemaIds.has(param.schemaId)) {
      return { $ref: `#/$defs/${param.schemaId}` };
    }

    // First encounter: build definition, store in $defs, return $ref
    const nextAncestors = new Set(ctx.ancestorSchemaIds);
    nextAncestors.add(param.schemaId);
    const nextCtx: JsonSchemaCtx = { ...ctx, ancestorSchemaIds: nextAncestors };

    const refParams = ctx.options.schemaMap[param.schemaId];
    const def = buildJsonSchemaNestedObject(refParams, nextCtx);

    if (param.additionalProperties) {
      def.additionalProperties = buildJsonSchemaProperty(param.additionalProperties, nextCtx);
    }

    ctx.$defs[param.schemaId] = def;
    return { $ref: `#/$defs/${param.schemaId}` };
  }

  // --- Inline properties ---
  if (param.properties && param.properties.length > 0) {
    const obj = buildJsonSchemaNestedObject(param.properties, ctx);
    if (param.additionalProperties) {
      obj.additionalProperties = buildJsonSchemaProperty(param.additionalProperties, ctx);
    }
    if (param.defaultValue !== undefined) obj.default = param.defaultValue;
    return obj;
  }

  // --- Pure Map/Record: no fixed properties, only additionalProperties ---
  if (param.additionalProperties) {
    return {
      type: "object",
      additionalProperties: buildJsonSchemaProperty(param.additionalProperties, ctx),
    };
  }

  // Fallback: empty object
  const s: JsonSchema7 = { type: "object" };
  if (param.defaultValue !== undefined) s.default = param.defaultValue;
  return s;
}

/** Build JSON Schema { type: "object", properties, required } from a child list. */
function buildJsonSchemaNestedObject(children: SchemaProperty[], ctx: JsonSchemaCtx): JsonSchema7 {
  const properties: Record<string, JsonSchema7> = {};
  const required: string[] = [];

  for (const child of children) {
    const prop = buildJsonSchemaProperty(child, ctx);
    if (child.description) prop.description = child.description;
    properties[child.name] = prop;
    if (child.required) required.push(child.name);
  }

  const s: JsonSchema7 = { type: "object", properties };
  if (required.length > 0) s.required = required;
  return s;
}

/** Build JSON Schema oneOf/anyOf from a union-type SchemaProperty. */
function buildJsonSchemaUnion(param: SchemaProperty, ctx: JsonSchemaCtx): JsonSchema7 {
  if (!param.variants || param.variants.length < 2) {
    return {};
  }

  // Build variant schemas, injecting discriminator const when discriminatorValues is provided
  const variantSchemas = param.variants.map((variantProps, i) => {
    const schema = buildJsonSchemaNestedObject(variantProps, ctx);
    const discValue = param.discriminator && param.discriminatorValues?.[i];
    if (discValue != null) {
      schema.properties = schema.properties || {};
      (schema.properties as Record<string, unknown>)[param.discriminator!] = { const: discValue };
      if (!(schema.required as string[] | undefined)?.includes(param.discriminator!)) {
        schema.required = [...((schema.required as string[]) || []), param.discriminator!];
      }
    }
    return schema;
  });

  const keyword = param.unionMode === "anyOf" ? "anyOf" : "oneOf";
  const s: JsonSchema7 = { [keyword]: variantSchemas };
  if (param.discriminator) {
    s.discriminator = { propertyName: param.discriminator };
  }
  if (param.defaultValue !== undefined) s.default = param.defaultValue;
  return s;
}

/**
 * Build a standard JSON Schema 7 object from a list of SchemaProperty definitions.
 * Generates schema directly without going through Zod.
 *
 * Supports the same features as `buildInputSchema` (Zod path):
 * - `schemaId` references → `$ref` + `$defs`
 * - Recursive self-reference detection → `$ref` (no infinite expansion)
 * - `additionalProperties` → JSON Schema `additionalProperties`
 * - `union` type → `oneOf` (with optional `discriminator`)
 * - `enumDatasetId` → resolved enum values from `options.datasetsById`
 */
export function buildJsonSchema(parameters: SchemaProperty[], options?: BuildSchemaOptions): JsonSchema7 {
  const ctx: JsonSchemaCtx = {
    options,
    ancestorSchemaIds: new Set(),
    $defs: {},
  };

  const properties: Record<string, JsonSchema7> = {};
  const required: string[] = [];

  for (const param of parameters) {
    const prop = buildJsonSchemaProperty(param, ctx);
    if (param.description) prop.description = param.description;
    properties[param.name] = prop;
    if (param.required) required.push(param.name);
  }

  const schema: JsonSchema7 = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  if (Object.keys(ctx.$defs).length > 0) schema.$defs = ctx.$defs;
  return schema;
}
