import { z } from "zod";
import type { ToolParameter } from "./types";

export interface BuildSchemaOptions {
  /** Datasets by UUID: id → resolved data. */
  datasetsById?: Record<string, unknown>;
  /** Schema map: schema UUID → resolved ToolParameter[]. */
  schemaMap?: Record<string, ToolParameter[]>;
}

/**
 * Build a zod schema for a single ToolParameter.
 */
function buildParamSchema(
  param: ToolParameter,
  options?: BuildSchemaOptions
): z.ZodTypeAny {
  // Resolve enum values from datasets or manual list
  let resolvedEnum: string[] | undefined;

  // enumDatasetId → from datasetsById (by UUID)
  if (param.enumDatasetId && options?.datasetsById?.[param.enumDatasetId] != null) {
    const val = options.datasetsById[param.enumDatasetId];
    resolvedEnum = resolveEnumFromValue(val);
  }

  if (!resolvedEnum) {
    resolvedEnum = param.enum;
  }

  let schema: z.ZodTypeAny;

  switch (param.type) {
    case "number":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "json":
      if (param.schemaId && options?.schemaMap?.[param.schemaId]) {
        // Use referenced schema's resolved parameters as properties
        const refParams = options.schemaMap[param.schemaId];
        const nested: Record<string, z.ZodTypeAny> = {};
        for (const child of refParams) {
          let childSchema = buildParamSchema(child, options);
          if (child.description) {
            childSchema = childSchema.describe(child.description);
          }
          if (!child.required) {
            childSchema = childSchema.optional();
          }
          nested[child.name] = childSchema;
        }
        schema = z.object(nested).passthrough();
      } else if (param.properties && param.properties.length > 0) {
        const nested: Record<string, z.ZodTypeAny> = {};
        for (const child of param.properties) {
          let childSchema = buildParamSchema(child, options);
          if (child.description) {
            childSchema = childSchema.describe(child.description);
          }
          if (!child.required) {
            childSchema = childSchema.optional();
          }
          nested[child.name] = childSchema;
        }
        schema = z.object(nested).passthrough();
      } else {
        schema = z.unknown();
      }
      break;
    case "enum":
      if (resolvedEnum && resolvedEnum.length > 0) {
        schema = z.enum(resolvedEnum as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;
    default:
      if (resolvedEnum && resolvedEnum.length > 0) {
        schema = z.enum(resolvedEnum as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;
  }

  if (param.isArray) {
    schema = z.array(schema);
  }

  return schema;
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
 * Build a zod object schema from a list of ToolParameter definitions.
 * Returns z.object({}) when parameters is empty (no-arg tool).
 *
 * When `options.datasetsById` is provided, `enumDatasetId` on a parameter
 * resolves to the dataset's values. For object-type datasets with string
 * values, uses Object.values(); for arrays, uses array elements; for
 * objects with non-string values, uses Object.keys().
 */
export function buildInputSchema(
  parameters: ToolParameter[],
  options?: BuildSchemaOptions
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of parameters) {
    let schema = buildParamSchema(param, options);

    if (param.description) {
      schema = schema.describe(param.description);
    }

    if (!param.required) {
      schema = schema.optional();
    }

    shape[param.name] = schema;
  }

  return z.object(shape);
}
