import { z } from "zod";
import type { ToolParameter } from "./types";

/**
 * Build a zod object schema from a list of ToolParameter definitions.
 * Returns z.object({}) when parameters is empty (no-arg tool).
 *
 * When `lookupVars` is provided, `enumRef` on a parameter resolves to
 * the lookup table's entry values (e.g. enumRef: "income_type" → values
 * from the income_type lookup table).
 *
 * When `activeVars` is provided, `enumRef` can also resolve to a list-type
 * template variable (an array of strings) or a json-type template variable
 * (a plain object whose values are used as enum options).
 */
export function buildInputSchema(
  parameters: ToolParameter[],
  lookupVars?: Record<string, Array<{ value: string }>>,
  activeVars?: Record<string, unknown>
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of parameters) {
    let schema: z.ZodTypeAny;

    // Resolve enumRef → actual enum values from lookup table or activeVars
    let resolvedEnum: string[] | undefined;
    if (param.enumRef) {
      if (lookupVars?.[param.enumRef]) {
        resolvedEnum = lookupVars[param.enumRef].map((e) => e.value);
      } else if (activeVars?.[param.enumRef] != null) {
        const val = activeVars[param.enumRef];
        if (Array.isArray(val)) {
          resolvedEnum = (val as unknown[]).map(String);
        } else if (typeof val === "object" && val !== null) {
          resolvedEnum = Object.values(val as Record<string, unknown>).map(String);
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
