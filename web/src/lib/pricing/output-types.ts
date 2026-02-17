/**
 * 定价工具共享类型
 *
 * 所有产品定价工具共用的输出 schema、类型、默认值
 */

import { z } from "zod";

// ============================================================================
// 引擎参数默认值
// ============================================================================

export const ENGINE_DEFAULTS = {
  lockDays: 30,
  extensionDays: 0,
} as const;

// ============================================================================
// 输出 Schema
// ============================================================================

/** 引用 */
export const citationSchema = z.object({
  quote: z.string(),
  docPath: z.string(),
  lines: z.object({
    start: z.number().int(),
    end: z.number().int(),
  }),
});

/** 触发的调整项 */
export const triggeredAdjustmentSchema = z.object({
  name: z.string(),
  expression: z.string().optional(),
  priceAdj: z.number().optional(),
  rateAdj: z.number().optional(),
  citations: z.array(citationSchema).optional(),
});

/** 定价选项 */
export const pricingOptionSchema = z.object({
  category: z.string(),
  baseRate: z.number(),
  basePrice: z.number(),
  finalRate: z.number(),
  finalPrice: z.number(),
  adjustments: z.array(triggeredAdjustmentSchema),
  lockDayAdj: z.number().optional(),
  extensionCost: z.number().optional(),
});

/** Rate sheet 引用 */
export const rateSheetSchema = z.object({
  type: z.enum(["pdf", "pptx", "image", "html"]),
  url: z.string(),
  title: z.string(),
});

/** 跳过的调整项 */
export const skippedAdjustmentSchema = z.object({
  name: z.string(),
  reason: z.literal("missing_field"),
  missingFields: z.array(z.string()),
  // 完整信息：让 AI 能告诉用户"如果提供了 X，可能会有 Y 调整"
  expression: z.string().optional(),
  priceAdj: z.number().optional(),
  rateAdj: z.number().optional(),
});

/** 共享输出 schema */
export const pricingOutputSchema = z.object({
  success: z.boolean(),
  productName: z.string(),
  options: z.array(pricingOptionSchema).optional(),
  error: z.string().optional(),
  rateSheets: z.array(rateSheetSchema).optional(),
  skippedAdjustments: z.array(skippedAdjustmentSchema).optional(),
  _uiRendered: z.literal(true),
  _message: z.string(),
});

// ============================================================================
// 类型导出
// ============================================================================

export type PricingOutput = z.infer<typeof pricingOutputSchema>;
export type PricingOption = z.infer<typeof pricingOptionSchema>;
export type TriggeredAdjustment = z.infer<typeof triggeredAdjustmentSchema>;
export type SkippedAdjustment = z.infer<typeof skippedAdjustmentSchema>;
export type Citation = z.infer<typeof citationSchema>;
