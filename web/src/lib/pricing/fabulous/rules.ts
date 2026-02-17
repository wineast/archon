/**
 * Fabulous 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 priceFabulous 工具使用
 *
 * 来源: GMCC Fabulous Rate Sheet 1.28.2026.md
 *
 * 产品特点：
 * - ARM Only: 5/6, 7/6, 10/6 SOFR ARM
 * - Margin: 2.75
 * - 锁定期: 30/45/60/75 天
 * - 贷款金额: $300K - $1M
 * - 最低 FICO: 700（Cash-Out 720）
 * - 最高 LTV: 80%（Cash-Out 75%）
 * - 地理限制: Florida 10 counties
 */

import type {
  BaseRate,
  Adjustment,
  ExtensionCost,
  LockDayPrice,
  LLPAMatrix,
  LLPARange,
} from "../types";

// ============================================================================
// 元信息
// ============================================================================

export const FABULOUS_RATE_SHEET = {
  productName: "Fabulous",
  effectiveDate: "2026-01-28",
  margin: 2.75,
  index: "SOFR",
  maxPrice: 100.7,
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/fabulous/rate-sheets/GMCC Fabulous Rate Sheet 1.28.2026.pdf",
      title: "GMCC Fabulous Rate Sheet 1.28.2026",
    },
  ],
} as const;

// ============================================================================
// 基准利率 - ARM Programs（30-Day 价格）
// ============================================================================

/** ARM 5/6 (Max Price 100.7) */
export const FABULOUS_BASE_RATES_5_6_ARM: BaseRate[] = [
  { category: "5/6 ARM", rate: 4.25, price: 97.612 },
  { category: "5/6 ARM", rate: 4.375, price: 98.034 },
  { category: "5/6 ARM", rate: 4.5, price: 98.456 },
  { category: "5/6 ARM", rate: 4.625, price: 98.879 },
  { category: "5/6 ARM", rate: 4.75, price: 99.303 },
  { category: "5/6 ARM", rate: 4.875, price: 99.727 },
  { category: "5/6 ARM", rate: 5.0, price: 100.152 },
  { category: "5/6 ARM", rate: 5.125, price: 100.564 },
  { category: "5/6 ARM", rate: 5.25, price: 100.806 },
  { category: "5/6 ARM", rate: 5.375, price: 100.807 },
  { category: "5/6 ARM", rate: 5.5, price: 100.808 },
];

/** ARM 7/6 (Max Price 100.7) */
export const FABULOUS_BASE_RATES_7_6_ARM: BaseRate[] = [
  { category: "7/6 ARM", rate: 4.75, price: 97.336 },
  { category: "7/6 ARM", rate: 4.875, price: 97.81 },
  { category: "7/6 ARM", rate: 5.0, price: 98.285 },
  { category: "7/6 ARM", rate: 5.125, price: 98.762 },
  { category: "7/6 ARM", rate: 5.25, price: 99.239 },
  { category: "7/6 ARM", rate: 5.375, price: 99.717 },
  { category: "7/6 ARM", rate: 5.5, price: 100.195 },
  { category: "7/6 ARM", rate: 5.625, price: 100.675 },
  { category: "7/6 ARM", rate: 5.75, price: 100.807 },
  { category: "7/6 ARM", rate: 5.875, price: 100.808 },
];

/** ARM 10/6 (Max Price 100.7) */
export const FABULOUS_BASE_RATES_10_6_ARM: BaseRate[] = [
  { category: "10/6 ARM", rate: 4.875, price: 96.165 },
  { category: "10/6 ARM", rate: 5.0, price: 96.704 },
  { category: "10/6 ARM", rate: 5.125, price: 97.244 },
  { category: "10/6 ARM", rate: 5.25, price: 97.786 },
  { category: "10/6 ARM", rate: 5.375, price: 98.329 },
  { category: "10/6 ARM", rate: 5.5, price: 98.874 },
  { category: "10/6 ARM", rate: 5.625, price: 99.419 },
  { category: "10/6 ARM", rate: 5.75, price: 99.966 },
  { category: "10/6 ARM", rate: 5.875, price: 100.513 },
  { category: "10/6 ARM", rate: 6.0, price: 100.807 },
];

/** 所有基准利率 */
export const FABULOUS_BASE_RATES: BaseRate[] = [
  ...FABULOUS_BASE_RATES_5_6_ARM,
  ...FABULOUS_BASE_RATES_7_6_ARM,
  ...FABULOUS_BASE_RATES_10_6_ARM,
];

// ============================================================================
// LLPA 矩阵数据
// ============================================================================

const RATE_SHEET_DOC_PATH =
  "fabulous/rate-sheets/GMCC Fabulous Rate Sheet 1.28.2026.md";

// FICO 范围定义（从高到低，与表格行对应）
const FABULOUS_FICO_RANGES: readonly LLPARange[] = [
  { label: "800+", min: 800, max: Infinity },
  { label: "780-799", min: 780, max: 799 },
  { label: "760-779", min: 760, max: 779 },
  { label: "740-759", min: 740, max: 759 },
  { label: "720-739", min: 720, max: 739 },
  { label: "700-719", min: 700, max: 719 },
];

// LTV 范围定义（8 列）
const FABULOUS_LTV_RANGES: readonly LLPARange[] = [
  { label: "0.01-30", min: 0.01, max: 30 },
  { label: "30.01-50", min: 30.01, max: 50 },
  { label: "50.01-55", min: 50.01, max: 55 },
  { label: "55.01-60", min: 55.01, max: 60 },
  { label: "60.01-65", min: 60.01, max: 65 },
  { label: "65.01-70", min: 65.01, max: 70 },
  { label: "70.01-75", min: 70.01, max: 75 },
  { label: "75.01-80", min: 75.01, max: 80 },
];

/**
 * FICO/LTV LLPA 矩阵
 *
 * 值说明：
 * - 正值 = 价格奖励（+price）
 * - 负值 = 价格惩罚（-price）
 * - Rate Sheet 中 (0.125) 表示惩罚 → -0.125
 */
const FABULOUS_FICO_LTV_LLPA: LLPAMatrix = {
  name: "Fabulous FICO/LTV LLPA",
  when: "true", // 无条件应用
  ficoRanges: FABULOUS_FICO_RANGES,
  ltvRanges: FABULOUS_LTV_RANGES,
  // 行: FICO（从高到低），列: LTV（从低到高）
  // 值来自 Rate Sheet 91-98 行
  values: [
    // 0-30    30-50   50-55   55-60   60-65   65-70   70-75   75-80
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.375, 0.125, -0.125], // 800+
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.375, 0.0, -0.125], // 780-799
    [0.375, 0.375, 0.375, 0.375, 0.375, 0.25, -0.125, -0.125], // 760-779
    [0.25, 0.25, 0.25, 0.25, 0.25, 0.125, -0.25, -0.25], // 740-759
    [0.25, 0.25, 0.25, 0.25, 0.125, -0.25, -0.375, -0.375], // 720-739
    [0.0, 0.0, -0.125, -0.125, -0.25, -0.375, -0.5, -0.5], // 700-719
  ],
  adjustmentType: "price",
  citation: {
    quote: "### FICO/LTV Adjustments",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 91, end: 98 },
  },
};

export const FABULOUS_LLPA_MATRICES: readonly LLPAMatrix[] = [
  FABULOUS_FICO_LTV_LLPA,
];

// ============================================================================
// 非矩阵调整项
// ============================================================================

/**
 * Fabulous 定价调整项（非矩阵规则）
 *
 * 包含 Cash-Out LTV 调整和 Small Balance 调整
 */
export const FABULOUS_ADJUSTMENTS: Adjustment[] = [
  // ============================================================================
  // Cash-Out Refinance LTV 调整
  // ============================================================================

  // Cash-Out LTV 0.01-50%: (0.125) = -0.125
  {
    name: "Cash-Out LTV <=50%",
    when: 'loanPurpose == "cashOut" and ltv <= 50',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| Cash-Out Refinance | (0.125) | (0.125) | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 104, end: 104 },
      },
    ],
  },

  // Cash-Out LTV 50.01-75%: (0.250) = -0.250
  {
    name: "Cash-Out LTV 50.01-75%",
    when: 'loanPurpose == "cashOut" and ltv > 50 and ltv <= 75',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Cash-Out Refinance | ... | (0.250) | (0.250) | (0.250) | (0.250) | (0.250) |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 104, end: 104 },
      },
    ],
  },

  // ============================================================================
  // Small Balance 调整（贷款金额 < $766,550）
  // ============================================================================

  // $300K - $400K: (0.375) = -0.375
  {
    name: "Small Balance $300K-$400K",
    when: "loanAmount >= 300000 and loanAmount < 400000",
    priceAdj: -0.375,
    citations: [
      {
        quote: "| $300K - $400K | (0.375) | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 110, end: 110 },
      },
    ],
  },

  // $400K - $600K: (0.250) = -0.250
  {
    name: "Small Balance $400K-$600K",
    when: "loanAmount >= 400000 and loanAmount < 600000",
    priceAdj: -0.25,
    citations: [
      {
        quote: "| $400K - $600K | (0.250) | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 111, end: 111 },
      },
    ],
  },

  // $600K - $766,550: (0.125) = -0.125
  {
    name: "Small Balance $600K-$766,550",
    when: "loanAmount >= 600000 and loanAmount <= 766550",
    priceAdj: -0.125,
    citations: [
      {
        quote: "| $600K - $766,550 | (0.125) | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 112, end: 112 },
      },
    ],
  },
];

// ============================================================================
// 锁定期调整
// ============================================================================

/**
 * 锁定期价格调整
 *
 * 计算方式：以 30-Day 为基准
 * 从 Rate Sheet 可推导：
 * - 30-Day: 97.612（5/6 ARM 4.25%）→ 基准
 * - 45-Day: 97.512 → 差值 -0.100
 * - 60-Day: 97.387 → 差值 -0.225
 * - 75-Day: 97.262 → 差值 -0.350
 */
export const FABULOUS_LOCK_DAY_PRICES: Record<number, LockDayPrice> = {
  30: { adjustment: 0 },
  45: { adjustment: -0.1 },
  60: { adjustment: -0.225 },
  75: { adjustment: -0.35 },
};

// ============================================================================
// 延期费用
// ============================================================================

/**
 * 延期费用
 *
 * Rate Sheet: Extensions: 2 bps/day
 * 2 bps = 0.02%
 */
export const FABULOUS_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 1, cost: 0.02, category: "all" },
];

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 */
export const FABULOUS_REQUIRED_FIELDS = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score (700-850, Cash-Out requires 720+)",
    example: 740,
  },
  ltv: {
    type: "number",
    description:
      "Loan-to-Value ratio (percentage, max 80% for Purchase/Rate-Term, max 75% for Cash-Out)",
    example: 70,
  },
  loanAmount: {
    type: "number",
    description: "Loan amount in dollars ($300,000 - $1,000,000)",
    example: 500000,
  },
  loanPurpose: {
    type: "enum",
    values: ["purchase", "refinance", "cashOut"],
    description: "Loan purpose",
    example: "purchase",
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

/**
 * Fabulous 产品完整定价配置
 */
export const FABULOUS_PRICING_CONFIG = {
  productName: FABULOUS_RATE_SHEET.productName,
  baseRates: FABULOUS_BASE_RATES,
  adjustments: FABULOUS_ADJUSTMENTS,
  llpaMatrices: FABULOUS_LLPA_MATRICES,
  stackingRules: [],
  extensionCosts: FABULOUS_EXTENSION_COSTS,
  rateSheets: FABULOUS_RATE_SHEET.rateSheets,
  lockDayPrices: FABULOUS_LOCK_DAY_PRICES,
} as const;
