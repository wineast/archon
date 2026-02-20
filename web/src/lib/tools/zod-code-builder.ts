import type { SchemaProperty } from "@/lib/schemas/types";
import { normalizeVariantItem, type BuildSchemaOptions } from "./schema-builder";

/* ─────────── Zod code string generation ─────────── */

interface ZodCodeCtx {
  options?: BuildSchemaOptions;
  ancestorSchemaIds: Set<string>;
  /** Schema UUID → human-friendly key for variable names. */
  schemaKeyMap?: Record<string, string>;
  /** Collected schema refs that need separate const declarations. */
  refs: Map<string, string>; // schemaId → generated code
}

function ind(depth: number): string {
  return "  ".repeat(depth);
}

function escStr(s: string): string {
  return JSON.stringify(s);
}

/** Build Zod code for a single SchemaProperty. */
function buildParamCode(
  param: SchemaProperty,
  ctx: ZodCodeCtx,
  depth: number
): string {
  let code: string;
  switch (param.type) {
    case "string":
      code = buildStringCode(param);
      break;
    case "number":
      code = buildNumberCode(param);
      break;
    case "boolean":
      code = "z.boolean()";
      break;
    case "null":
      code = "z.null()";
      break;
    case "const":
      code = buildConstCode(param);
      break;
    case "enum":
      code = buildEnumCode(param, ctx);
      break;
    case "object":
      code = buildObjectCode(param, ctx, depth);
      break;
    case "array":
      code = buildArrayCode(param, ctx, depth);
      break;
    case "union":
      code = buildUnionCode(param, ctx, depth);
      break;
    default:
      code = "z.string()";
  }
  if (param.nullable) code += ".nullable()";
  return code;
}

function buildStringCode(param: SchemaProperty): string {
  let code = "z.string()";
  if (param.minLength != null) code += `.min(${param.minLength})`;
  if (param.maxLength != null) code += `.max(${param.maxLength})`;
  if (param.pattern) code += `.regex(new RegExp(${escStr(param.pattern)}))`;
  if (param.format === "email") code += ".email()";
  if (param.format === "url") code += ".url()";
  if (param.format === "uuid") code += ".uuid()";
  if (param.format === "date") code += ".date()";
  if (param.format === "date-time") code += ".datetime()";
  if (param.format === "time") code += ".time()";
  if (param.format === "ipv4") code += ".ipv4()";
  if (param.format === "ipv6") code += ".ipv6()";
  return code;
}

function buildNumberCode(param: SchemaProperty): string {
  let code = "z.number()";
  if (param.integer) code += ".int()";
  if (param.minimum != null) code += `.min(${param.minimum})`;
  if (param.maximum != null) code += `.max(${param.maximum})`;
  if (param.exclusiveMinimum != null) code += `.gt(${param.exclusiveMinimum})`;
  if (param.exclusiveMaximum != null) code += `.lt(${param.exclusiveMaximum})`;
  if (param.multipleOf != null) code += `.multipleOf(${param.multipleOf})`;
  return code;
}

function buildConstCode(param: SchemaProperty): string {
  if (param.constValue !== undefined) {
    return `z.literal(${JSON.stringify(param.constValue)})`;
  }
  return "z.unknown()";
}

function buildEnumCode(param: SchemaProperty, ctx: ZodCodeCtx): string {
  const values = resolveEnumValues(param, ctx);
  if (values && values.length > 0) {
    const items = values.map((v) => escStr(v)).join(", ");
    return `z.enum([${items}])`;
  }
  return "z.string()";
}

function resolveEnumValues(
  param: SchemaProperty,
  ctx: ZodCodeCtx
): string[] | undefined {
  if (
    param.enumDatasetId &&
    ctx.options?.datasetsById?.[param.enumDatasetId] != null
  ) {
    const val = ctx.options.datasetsById[param.enumDatasetId];
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === "object" && val !== null) {
      const values = Object.values(val as Record<string, unknown>);
      if (values.length > 0 && typeof values[0] === "string") {
        return values.map(String);
      }
      return Object.keys(val as Record<string, unknown>);
    }
  }
  return param.enum;
}

function buildObjectCode(
  param: SchemaProperty,
  ctx: ZodCodeCtx,
  depth: number
): string {
  // --- schemaId reference ---
  if (param.schemaId && ctx.options?.schemaMap?.[param.schemaId]) {
    if (ctx.ancestorSchemaIds.has(param.schemaId)) {
      const varName = schemaVarName(param.schemaId, ctx);
      return `z.lazy(() => ${varName})`;
    }

    const nextAncestors = new Set(ctx.ancestorSchemaIds);
    nextAncestors.add(param.schemaId);
    const nextCtx: ZodCodeCtx = { ...ctx, ancestorSchemaIds: nextAncestors };

    const refParams = ctx.options.schemaMap[param.schemaId];
    let code = buildNestedObjectCode(refParams, nextCtx, depth);
    if (param.additionalProperties) {
      const valCode = buildParamCode(
        param.additionalProperties,
        nextCtx,
        depth + 1
      );
      code += `.catchall(${valCode})`;
    }
    return code;
  }

  // --- allOf: merge multiple schemas ---
  if (param.schemaIds && param.schemaIds.length > 0 && ctx.options?.schemaMap) {
    const merged: SchemaProperty[] = [];
    const seen = new Set<string>();
    for (const sid of param.schemaIds) {
      const refParams = ctx.options.schemaMap[sid];
      if (refParams) {
        for (const p of refParams) {
          if (seen.has(p.name)) {
            const idx = merged.findIndex((m) => m.name === p.name);
            if (idx >= 0) merged[idx] = p;
          } else {
            seen.add(p.name);
            merged.push(p);
          }
        }
      }
    }
    if (merged.length > 0) {
      let code = buildNestedObjectCode(merged, ctx, depth);
      if (param.additionalProperties) {
        const valCode = buildParamCode(
          param.additionalProperties,
          ctx,
          depth + 1
        );
        code += `.catchall(${valCode})`;
      }
      return code;
    }
  }

  // --- Inline properties ---
  if (param.properties && param.properties.length > 0) {
    let code = buildNestedObjectCode(param.properties, ctx, depth);
    if (param.additionalProperties) {
      const valCode = buildParamCode(
        param.additionalProperties,
        ctx,
        depth + 1
      );
      code += `.catchall(${valCode})`;
    }
    return code;
  }

  // --- Pure Map/Record ---
  if (param.additionalProperties) {
    const valCode = buildParamCode(
      param.additionalProperties,
      ctx,
      depth + 1
    );
    return `z.record(z.string(), ${valCode})`;
  }

  return "z.unknown()";
}

function buildNestedObjectCode(
  children: SchemaProperty[] | undefined,
  ctx: ZodCodeCtx,
  depth: number
): string {
  if (!Array.isArray(children) || children.length === 0) return "z.object({})";

  const lines: string[] = [];
  lines.push("z.object({");
  for (const child of children) {
    let code = buildParamCode(child, ctx, depth + 1);
    if (child.description) code += `.describe(${escStr(child.description)})`;
    if (!child.required) {
      if (child.defaultValue !== undefined) {
        code += `.default(${JSON.stringify(child.defaultValue)})`;
      } else {
        code += ".optional()";
      }
    }
    lines.push(`${ind(depth + 1)}${child.name}: ${code},`);
  }
  lines.push(`${ind(depth)}})`);
  return lines.join("\n");
}

function buildArrayCode(
  param: SchemaProperty,
  ctx: ZodCodeCtx,
  depth: number
): string {
  if (param.tuple && param.prefixItems && param.prefixItems.length > 0) {
    const items = param.prefixItems.map((item) =>
      buildParamCode(item, ctx, depth + 1)
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
  if (param.items) {
    itemCode = buildParamCode(param.items, ctx, depth + 1);
  }
  let code = `z.array(${itemCode})`;
  if (param.minItems != null) code += `.min(${param.minItems})`;
  if (param.maxItems != null) code += `.max(${param.maxItems})`;
  return code;
}

function buildUnionCode(
  param: SchemaProperty,
  ctx: ZodCodeCtx,
  depth: number
): string {
  const variants = Array.isArray(param.variants) ? param.variants : [];
  if (variants.length < 2) return "z.unknown()";

  const variantCodes = variants.map((raw, i) => {
    const variant = normalizeVariantItem(raw);
    let code: string;

    if (variant.type === "object") {
      code = buildObjectCode(variant, ctx, depth + 1);
    } else {
      code = buildParamCode(variant, ctx, depth + 1);
    }

    const discValue = param.discriminator
      ? param.discriminatorValues?.[i]
      : undefined;
    if (discValue && variant.type === "object") {
      code += `.extend({ ${param.discriminator!}: z.literal(${escStr(discValue)}) })`;
    }
    return code;
  });

  if (param.unionMode === "anyOf" || !param.discriminator) {
    const lines: string[] = [];
    lines.push("z.union([");
    for (const vc of variantCodes) {
      // Indent each line of the variant code
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
  lines.push(`z.discriminatedUnion(${escStr(param.discriminator)}, [`);
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

function schemaVarName(schemaId: string, ctx: ZodCodeCtx): string {
  const key = ctx.schemaKeyMap?.[schemaId];
  if (key) return camelCase(key) + "Schema";
  return `schema_${schemaId.slice(0, 8)}`;
}

function camelCase(s: string): string {
  return s.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());
}

/**
 * Build a Zod TypeScript code string from a list of SchemaProperty definitions.
 *
 * Returns a ready-to-use TypeScript snippet with `import { z } from "zod"` header.
 */
export function buildZodCode(
  parameters: SchemaProperty[],
  options?: BuildSchemaOptions & {
    /** Map of schema UUID → human-friendly key for variable names. */
    schemaKeyMap?: Record<string, string>;
  }
): string {
  const ctx: ZodCodeCtx = {
    options,
    ancestorSchemaIds: new Set(),
    schemaKeyMap: options?.schemaKeyMap,
    refs: new Map(),
  };

  const lines: string[] = [];
  lines.push('import { z } from "zod";');
  lines.push("");

  // Build main schema
  const objectCode = buildNestedObjectCode(parameters, ctx, 0);
  lines.push(`const schema = ${objectCode};`);

  return lines.join("\n");
}
