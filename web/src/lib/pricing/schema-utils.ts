/**
 * 定价工具 Schema 工具函数
 *
 * 从 REQUIRED_FIELDS 动态生成 Zod inputSchema，确保单一数据源
 */

import { z } from "zod";
import type { PricingFieldDef } from "./types";

/**
 * 根据字段定义生成 Zod schema
 *
 * @param def 字段定义
 * @returns Zod schema（有 defaultValue 用 .default()，否则用 .optional()）
 */
export function createFieldSchema(def: PricingFieldDef): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  if (def.type === "enum" && def.values) {
    schema = z.enum([...def.values] as [string, ...string[]]);
  } else if (def.type === "number") {
    schema = z.number();
  } else if (def.type === "boolean") {
    schema = z.boolean();
  } else {
    // fallback（理论上不会到这里）
    schema = z.string();
  }

  // 有默认值用 .default()，否则 .optional()
  if (def.defaultValue !== undefined) {
    schema = schema.default(def.defaultValue).describe(def.description);
  } else {
    schema = schema.optional().describe(def.description);
  }

  return schema;
}

/**
 * 从 REQUIRED_FIELDS 动态生成 inputSchema
 *
 * @param fields 产品的 REQUIRED_FIELDS 对象
 * @returns Zod object schema
 */
export function createPricingInputSchema(
  fields: Record<string, PricingFieldDef>
): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [name, def] of Object.entries(fields)) {
    shape[name] = createFieldSchema(def);
  }

  // 公共字段（所有产品都有，使用 .default() 实现业务默认值）
  shape.lockDays = z
    .number()
    .int()
    .positive()
    .default(30)
    .describe("Lock period in days");
  shape.extensionDays = z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Extension days");

  return z.object(shape);
}
