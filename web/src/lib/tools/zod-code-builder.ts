import type { JsonSchema7 } from "@/lib/schemas/types";
import type { BuildSchemaOptions } from "./schema-builder";

/* ─────────── Zod code string generation ─────────── */

interface ZodCodeCtx {
  options?: BuildSchemaOptions;
  ancestorKeys: Set<string>;
  /** Collected schema refs that need separate const declarations. */
  refs: Map<string, string>;
}

function ind(depth: number): string {
  return "  ".repeat(depth);
}

function escStr(s: string): string {
  return JSON.stringify(s);
}

/** Build Zod code for a single JSON Schema 7 property. */
function buildPropertyCode(
  schema: JsonSchema7,
  ctx: ZodCodeCtx,
  depth: number
): string {
  // $ref resolution
  if (schema.$ref) {
    return buildRefCode(schema, ctx, depth);
  }

  // const
  if (schema.const !== undefined) {
    return `z.literal(${JSON.stringify(schema.const)})`;
  }

  // nullable pattern: anyOf: [T, {type:"null"}]
  if (schema.anyOf && schema.anyOf.length === 2 && schema.anyOf.some((s) => s.type === "null")) {
    const nonNull = schema.anyOf.find((s) => s.type !== "null")!;
    return buildPropertyCode(nonNull, ctx, depth) + ".nullable()";
  }

  // union: oneOf / anyOf
  if (schema.oneOf && schema.oneOf.length >= 2) {
    return buildUnionCode(schema, ctx, depth);
  }
  if (schema.anyOf && schema.anyOf.length >= 2) {
    return buildUnionCode(schema, ctx, depth);
  }

  // allOf composition
  if (schema.allOf && schema.allOf.length > 0) {
    return buildAllOfCode(schema, ctx, depth);
  }

  // enum
  if (schema.enum && schema.enum.length > 0) {
    return buildEnumCode(schema);
  }

  const t = schema.type;

  switch (t) {
    case "string":
      return buildStringCode(schema);
    case "integer":
      return buildIntegerCode(schema);
    case "number":
      return buildNumberCode(schema);
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    case "object":
      return buildObjectCode(schema, ctx, depth);
    case "array":
      return buildArrayCode(schema, ctx, depth);
    default:
      return "z.unknown()";
  }
}

function buildStringCode(schema: JsonSchema7): string {
  let code = "z.string()";
  if (schema.minLength != null) code += `.min(${schema.minLength})`;
  if (schema.maxLength != null) code += `.max(${schema.maxLength})`;
  if (schema.pattern) code += `.regex(new RegExp(${escStr(schema.pattern)}))`;
  if (schema.format === "email") code += ".email()";
  if (schema.format === "url") code += ".url()";
  if (schema.format === "uuid") code += ".uuid()";
  if (schema.format === "date") code += ".date()";
  if (schema.format === "date-time") code += ".datetime()";
  if (schema.format === "time") code += ".time()";
  if (schema.format === "ipv4") code += ".ipv4()";
  if (schema.format === "ipv6") code += ".ipv6()";
  return code;
}

function buildIntegerCode(schema: JsonSchema7): string {
  let code = "z.number().int()";
  if (schema.minimum != null) code += `.min(${schema.minimum})`;
  if (schema.maximum != null) code += `.max(${schema.maximum})`;
  if (schema.exclusiveMinimum != null) code += `.gt(${schema.exclusiveMinimum})`;
  if (schema.exclusiveMaximum != null) code += `.lt(${schema.exclusiveMaximum})`;
  if (schema.multipleOf != null) code += `.multipleOf(${schema.multipleOf})`;
  return code;
}

function buildNumberCode(schema: JsonSchema7): string {
  let code = "z.number()";
  if (schema.minimum != null) code += `.min(${schema.minimum})`;
  if (schema.maximum != null) code += `.max(${schema.maximum})`;
  if (schema.exclusiveMinimum != null) code += `.gt(${schema.exclusiveMinimum})`;
  if (schema.exclusiveMaximum != null) code += `.lt(${schema.exclusiveMaximum})`;
  if (schema.multipleOf != null) code += `.multipleOf(${schema.multipleOf})`;
  return code;
}

function buildEnumCode(schema: JsonSchema7): string {
  const values = schema.enum?.map(String);
  if (values && values.length > 0) {
    const items = values.map((v) => escStr(v)).join(", ");
    return `z.enum([${items}])`;
  }
  return "z.string()";
}

/** Build Zod code for a $ref. */
function buildRefCode(
  schema: JsonSchema7,
  ctx: ZodCodeCtx,
  depth: number
): string {
  const ref = schema.$ref;
  if (!ref) return "z.unknown()";

  const key = ref.replace("#/$defs/", "");
  const refSchema = ctx.options?.defsMap?.[key];
  if (!refSchema) return "z.unknown()";

  // Cycle detection — use z.lazy()
  if (ctx.ancestorKeys.has(key)) {
    const varName = camelCase(key) + "Schema";
    return `z.lazy(() => ${varName})`;
  }

  const nextKeys = new Set(ctx.ancestorKeys);
  nextKeys.add(key);
  const nextCtx: ZodCodeCtx = { ...ctx, ancestorKeys: nextKeys };
  return buildPropertyCode(refSchema, nextCtx, depth);
}

/** Build Zod code for allOf composition. */
function buildAllOfCode(
  schema: JsonSchema7,
  ctx: ZodCodeCtx,
  depth: number
): string {
  const mergedProps: Record<string, JsonSchema7> = {};
  const mergedRequired = new Set<string>();

  for (const item of schema.allOf ?? []) {
    let resolved = item;
    if (item.$ref) {
      const key = item.$ref.replace("#/$defs/", "");
      const refSchema = ctx.options?.defsMap?.[key];
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

  // Also merge the schema's own properties
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
    return buildNestedObjectCode(merged, ctx, depth);
  }

  return "z.unknown()";
}

function buildObjectCode(
  schema: JsonSchema7,
  ctx: ZodCodeCtx,
  depth: number
): string {
  // --- Inline properties ---
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    let code = buildNestedObjectCode(schema, ctx, depth);
    if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      const valCode = buildPropertyCode(schema.additionalProperties, ctx, depth + 1);
      code += `.catchall(${valCode})`;
    }
    return code;
  }

  // --- Pure Map/Record ---
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    const valCode = buildPropertyCode(schema.additionalProperties, ctx, depth + 1);
    return `z.record(z.string(), ${valCode})`;
  }

  return "z.unknown()";
}

function buildNestedObjectCode(
  schema: JsonSchema7,
  ctx: ZodCodeCtx,
  depth: number
): string {
  if (!schema.properties || Object.keys(schema.properties).length === 0) return "z.object({})";

  const requiredSet = new Set(schema.required ?? []);
  const lines: string[] = [];
  lines.push("z.object({");
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let code = buildPropertyCode(propSchema, ctx, depth + 1);
    if (propSchema.description) code += `.describe(${escStr(propSchema.description)})`;
    if (!requiredSet.has(key)) {
      if (propSchema.default !== undefined) {
        code += `.default(${JSON.stringify(propSchema.default)})`;
      } else {
        code += ".optional()";
      }
    }
    lines.push(`${ind(depth + 1)}${key}: ${code},`);
  }
  lines.push(`${ind(depth)}})`);
  return lines.join("\n");
}

function buildArrayCode(
  schema: JsonSchema7,
  ctx: ZodCodeCtx,
  depth: number
): string {
  // Tuple
  if (schema.prefixItems && schema.prefixItems.length > 0) {
    const items = schema.prefixItems.map((item) =>
      buildPropertyCode(item, ctx, depth + 1)
    );
    if (items.length <= 3 && items.every((i) => i.length < 30)) {
      return `z.tuple([${items.join(", ")}])`;
    }
    const lines: string[] = [];
    lines.push("z.tuple([");
    for (const item of items) {
      lines.push(`${ind(depth + 1)}${item},`);
    }
    lines.push(`${ind(depth)}])`);
    return lines.join("\n");
  }

  let itemCode = "z.unknown()";
  if (schema.items && !Array.isArray(schema.items)) {
    itemCode = buildPropertyCode(schema.items, ctx, depth + 1);
  }
  let code = `z.array(${itemCode})`;
  if (schema.minItems != null) code += `.min(${schema.minItems})`;
  if (schema.maxItems != null) code += `.max(${schema.maxItems})`;
  return code;
}

function buildUnionCode(
  schema: JsonSchema7,
  ctx: ZodCodeCtx,
  depth: number
): string {
  const unionMode = schema["x-unionMode"] ?? (schema.oneOf ? "oneOf" : "anyOf");
  const variants = (unionMode === "anyOf" ? schema.anyOf : schema.oneOf) ?? [];
  if (variants.length < 2) return "z.unknown()";

  const discriminator = schema["x-discriminator"];
  const discriminatorValues = schema["x-discriminatorValues"];

  const variantCodes = variants.map((variant, i) => {
    let code: string;

    if (variant.type === "object" || variant.properties) {
      code = buildObjectCode(variant, ctx, depth + 1);
    } else {
      code = buildPropertyCode(variant, ctx, depth + 1);
    }

    const discValue = discriminator ? discriminatorValues?.[i] : undefined;
    if (discValue && (variant.type === "object" || variant.properties)) {
      code += `.extend({ ${discriminator}: z.literal(${escStr(discValue)}) })`;
    }
    return code;
  });

  if (unionMode === "anyOf" || !discriminator) {
    const lines: string[] = [];
    lines.push("z.union([");
    for (const vc of variantCodes) {
      const indented = vc
        .split("\n")
        .map((l, li) => (li === 0 ? `${ind(depth + 1)}${l}` : l))
        .join("\n");
      lines.push(`${indented},`);
    }
    lines.push(`${ind(depth)}])`);
    return lines.join("\n");
  }

  // discriminatedUnion
  const lines: string[] = [];
  lines.push(`z.discriminatedUnion(${escStr(discriminator)}, [`);
  for (const vc of variantCodes) {
    const indented = vc
      .split("\n")
      .map((l, li) => (li === 0 ? `${ind(depth + 1)}${l}` : l))
      .join("\n");
    lines.push(`${indented},`);
  }
  lines.push(`${ind(depth)}])`);
  return lines.join("\n");
}

function camelCase(s: string): string {
  return s.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());
}

/**
 * Build a Zod TypeScript code string from a JSON Schema 7 object.
 *
 * Returns a ready-to-use TypeScript snippet with `import { z } from "zod"` header.
 */
export function buildZodCode(
  schema: JsonSchema7,
  options?: BuildSchemaOptions
): string {
  const ctx: ZodCodeCtx = {
    options,
    ancestorKeys: new Set(),
    refs: new Map(),
  };

  const lines: string[] = [];
  lines.push('import { z } from "zod";');
  lines.push("");

  const objectCode = buildNestedObjectCode(schema, ctx, 0);
  lines.push(`const schema = ${objectCode};`);

  return lines.join("\n");
}
