/**
 * 定价规则类型定义
 *
 * 这些类型由 pricing-rules 数据和 runPricingSOP 引擎共用
 */

// ============================================================================
// 引擎默认值
// ============================================================================

export const ENGINE_DEFAULTS = {
  lockDays: 30,
  extensionDays: 0,
} as const;

// ============================================================================
// 字段定义类型（用于动态生成 inputSchema）
// ============================================================================

/** 定价字段定义 - 用于动态生成 Zod inputSchema */
export interface PricingFieldDef {
  type: "number" | "boolean" | "enum";
  description: string;
  values?: readonly string[]; // enum 类型专用
  example?: unknown;
  defaultValue?: unknown; // 字段默认值，有此值时 schema 用 .default() 而非 .optional()
}

// ============================================================================
// 基础类型
// ============================================================================

/** 基准利率 */
export interface BaseRate {
  category: string;
  rate: number;
  price: number;
  /** 展示条件（filtrex 表达式），不满足时不显示该利率选项 */
  when?: string;
}

/** 引用（来源追溯） */
export interface Citation {
  quote: string;
  docPath: string;
  lines: {
    start: number;
    end: number;
  };
}

/** 调整项 */
export interface Adjustment {
  name: string;
  when: string;
  priceAdj?: number;
  rateAdj?: number;
  appliesTo?: string[];
  citations?: Citation[];
}

/** 叠加规则 */
export interface StackingRule {
  type: "mutex" | "max-one" | "sum-cap";
  members: string[];
  cap?: number;
}

/** 延期费用 */
export interface ExtensionCost {
  days: number;
  cost: number;
  category: string;
}

/** 锁定期价格 */
export interface LockDayPrice {
  adjustment: number;
  appliesTo?: string[];
}

/** Rate sheet 引用 */
export interface RateSheet {
  type: "pdf" | "pptx" | "image" | "html";
  url: string;
  title: string;
}

// ============================================================================
// LLPA 矩阵类型（用于压缩 FICO × LTV 二维查表规则）
// ============================================================================

/** LLPA 矩阵范围定义 */
export interface LLPARange {
  label: string; // 显示标签，如 "≥780", "75.01-80"
  min: number; // 最小值（含）
  max: number; // 最大值（含），用 Infinity 表示无上限
}

/** LLPA 矩阵定义 */
export interface LLPAMatrix {
  name: string; // 矩阵名称，如 "Conforming Purchase LLPA"
  when: string; // 前置条件表达式，如 'loanAmount <= 806500 and loanPurpose == "purchase"'
  ficoRanges: readonly LLPARange[]; // FICO 分数范围（行）
  ltvRanges: readonly LLPARange[]; // LTV 范围（列）
  values: readonly (readonly (number | null)[])[]; // 调整值矩阵，null = N/A
  /**
   * 调整类型
   * - `"fee"`: 费用调整（表格值 = 收取费用 = 减少 price）
   * - `"price"`: 价格调整（表格值 = 减少 price）
   * - `"rate"`: 利率调整（表格值 = 增加 rate）
   *
   * 注意：`"fee"` 和 `"price"` 计算逻辑相同（都是 priceAdj = -value），
   * 区别仅在语义上：fee 更准确反映 Rate Sheet 原文 "Fee Adjustments"
   */
  adjustmentType: "fee" | "price" | "rate";
  citation: Citation; // 单个引用指向整个表格
}

// ============================================================================
// 产品配置
// ============================================================================

/** 产品定价配置 */
export interface ProductPricingConfig {
  productName: string;
  baseRates: readonly BaseRate[];
  adjustments: readonly Adjustment[];
  stackingRules: readonly StackingRule[];
  extensionCosts: readonly ExtensionCost[];
  rateSheets: readonly RateSheet[];
  llpaMatrices?: readonly LLPAMatrix[]; // LLPA 矩阵（可选）
}
