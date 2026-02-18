import { z } from "zod";
import type { ToolParameter } from "./types";

/**
 * Build a zod object schema from a list of ToolParameter definitions.
 * Returns z.object({}) when parameters is empty (no-arg tool).
 *
 * When `resolvedVars` is provided, `enumRef` on a parameter resolves to
 * the dataset's values. For object-type datasets with string values,
 * uses Object.values(); for arrays, uses array elements; for objects
 * with non-string values, uses Object.keys().
 */
export function buildInputSchema(
  parameters: ToolParameter[],
  resolvedVars?: Record<string, unknown>
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of parameters) {
    let schema: z.ZodTypeAny;

    // Resolve enumRef → actual enum values from datasets
    let resolvedEnum: string[] | undefined;
    if (param.enumRef && resolvedVars?.[param.enumRef] != null) {
      const val = resolvedVars[param.enumRef];
      if (Array.isArray(val)) {
        resolvedEnum = val.map(String);
      } else if (typeof val === "object" && val !== null) {
        const values = Object.values(val as Record<string, unknown>);
        if (values.length > 0 && typeof values[0] === "string") {
          resolvedEnum = values.map(String);
        } else {
          resolvedEnum = Object.keys(val as Record<string, unknown>);
        }
      }
    }
    if (!resolvedEnum) {
      resolvedEnum = param.enum;
    }

    switch (param.type) {
      case "number":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
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
