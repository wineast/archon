/**
 * Thunder 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 priceThunder 工具使用
 *
 * 来源: GMCC Thunder Rate Sheet 12.23.2025.md
 *
 * 注意：Thunder 的调整是 PRICE 调整（priceAdj），不是 rate 调整
 * Thunder 是 Conforming/Jumbo 产品，使用 30-Day 价格作为基准
 *
 * 重构说明：使用 LLPA 矩阵格式压缩 FICO × LTV 二维查表规则
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

export const THUNDER_RATE_SHEET = {
  productName: "Thunder",
  effectiveDate: "2025-12-23",
  margin: 2.75,
  index: "SOFR 30A",
  conformingLimit: 806500,
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/thunder/rate-sheets/GMCC Thunder Rate Sheet 12.23.2025.pdf",
      title: "GMCC Thunder Rate Sheet 12.23.2025",
    },
  ],
} as const;

// ============================================================================
// 基准利率 - Fixed Rate Programs（30-Day 价格）
// ============================================================================

// 价格计算：表格中 (0.750) 表示折扣 → price = 100 - 0.750 = 99.25

/** 10-Year Fixed Conforming */
export const THUNDER_BASE_RATES_10_FIXED_CONFORMING: BaseRate[] = [
  { category: "10 Year Fixed Conforming", rate: 6.0, price: 99.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "10 Year Fixed Conforming", rate: 6.125, price: 99.0, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "10 Year Fixed Conforming", rate: 6.25, price: 98.75, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "10 Year Fixed Conforming", rate: 6.375, price: 98.5, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "10 Year Fixed Conforming", rate: 6.5, price: 98.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
];

/** 10-Year Fixed Jumbo */
export const THUNDER_BASE_RATES_10_FIXED_JUMBO: BaseRate[] = [
  { category: "10 Year Fixed Jumbo", rate: 6.25, price: 99.25, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "10 Year Fixed Jumbo", rate: 6.375, price: 99.0, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "10 Year Fixed Jumbo", rate: 6.5, price: 98.75, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "10 Year Fixed Jumbo", rate: 6.625, price: 98.5, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "10 Year Fixed Jumbo", rate: 6.75, price: 98.25, when: 'loanType == "fixed" and loanAmount > 806500' },
];

/** 15-Year Fixed Conforming */
export const THUNDER_BASE_RATES_15_FIXED_CONFORMING: BaseRate[] = [
  { category: "15 Year Fixed Conforming", rate: 6.125, price: 99.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "15 Year Fixed Conforming", rate: 6.25, price: 99.0, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "15 Year Fixed Conforming", rate: 6.375, price: 98.75, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "15 Year Fixed Conforming", rate: 6.5, price: 98.5, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "15 Year Fixed Conforming", rate: 6.625, price: 98.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
];

/** 15-Year Fixed Jumbo */
export const THUNDER_BASE_RATES_15_FIXED_JUMBO: BaseRate[] = [
  { category: "15 Year Fixed Jumbo", rate: 6.375, price: 99.25, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "15 Year Fixed Jumbo", rate: 6.5, price: 99.0, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "15 Year Fixed Jumbo", rate: 6.625, price: 98.75, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "15 Year Fixed Jumbo", rate: 6.75, price: 98.5, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "15 Year Fixed Jumbo", rate: 6.875, price: 98.25, when: 'loanType == "fixed" and loanAmount > 806500' },
];

/** 20-Year Fixed Conforming */
export const THUNDER_BASE_RATES_20_FIXED_CONFORMING: BaseRate[] = [
  { category: "20 Year Fixed Conforming", rate: 6.375, price: 99.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "20 Year Fixed Conforming", rate: 6.5, price: 99.0, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "20 Year Fixed Conforming", rate: 6.625, price: 98.75, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "20 Year Fixed Conforming", rate: 6.75, price: 98.5, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "20 Year Fixed Conforming", rate: 6.875, price: 98.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
];

/** 20-Year Fixed Jumbo */
export const THUNDER_BASE_RATES_20_FIXED_JUMBO: BaseRate[] = [
  { category: "20 Year Fixed Jumbo", rate: 6.625, price: 99.25, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "20 Year Fixed Jumbo", rate: 6.75, price: 99.0, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "20 Year Fixed Jumbo", rate: 6.875, price: 98.75, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "20 Year Fixed Jumbo", rate: 7.0, price: 98.5, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "20 Year Fixed Jumbo", rate: 7.125, price: 98.25, when: 'loanType == "fixed" and loanAmount > 806500' },
];

/** 30-Year Fixed Conforming */
export const THUNDER_BASE_RATES_30_FIXED_CONFORMING: BaseRate[] = [
  { category: "30 Year Fixed Conforming", rate: 6.625, price: 99.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "30 Year Fixed Conforming", rate: 6.75, price: 99.0, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "30 Year Fixed Conforming", rate: 6.875, price: 98.75, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "30 Year Fixed Conforming", rate: 7.0, price: 98.5, when: 'loanType == "fixed" and loanAmount <= 806500' },
  { category: "30 Year Fixed Conforming", rate: 7.125, price: 98.25, when: 'loanType == "fixed" and loanAmount <= 806500' },
];

/** 30-Year Fixed Jumbo */
export const THUNDER_BASE_RATES_30_FIXED_JUMBO: BaseRate[] = [
  { category: "30 Year Fixed Jumbo", rate: 6.875, price: 99.25, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "30 Year Fixed Jumbo", rate: 7.0, price: 99.0, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "30 Year Fixed Jumbo", rate: 7.125, price: 98.75, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "30 Year Fixed Jumbo", rate: 7.25, price: 98.5, when: 'loanType == "fixed" and loanAmount > 806500' },
  { category: "30 Year Fixed Jumbo", rate: 7.375, price: 98.25, when: 'loanType == "fixed" and loanAmount > 806500' },
];

// ============================================================================
// 基准利率 - ARM Programs（30-Day 价格）
// ============================================================================

/** 3/6 SOFR ARM Conforming */
export const THUNDER_BASE_RATES_3_6_ARM_CONFORMING: BaseRate[] = [
  { category: "3/6 ARM Conforming", rate: 5.625, price: 99.25, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "3/6 ARM Conforming", rate: 5.75, price: 99.0, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "3/6 ARM Conforming", rate: 5.875, price: 98.75, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "3/6 ARM Conforming", rate: 6.0, price: 98.5, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "3/6 ARM Conforming", rate: 6.125, price: 98.25, when: 'loanType == "arm" and loanAmount <= 806500' },
];

/** 3/6 SOFR ARM Jumbo */
export const THUNDER_BASE_RATES_3_6_ARM_JUMBO: BaseRate[] = [
  { category: "3/6 ARM Jumbo", rate: 5.625, price: 99.25, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "3/6 ARM Jumbo", rate: 5.75, price: 99.0, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "3/6 ARM Jumbo", rate: 5.875, price: 98.75, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "3/6 ARM Jumbo", rate: 6.0, price: 98.5, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "3/6 ARM Jumbo", rate: 6.125, price: 98.25, when: 'loanType == "arm" and loanAmount > 806500' },
];

/** 5/6 SOFR ARM Conforming */
export const THUNDER_BASE_RATES_5_6_ARM_CONFORMING: BaseRate[] = [
  { category: "5/6 ARM Conforming", rate: 5.75, price: 99.25, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "5/6 ARM Conforming", rate: 5.875, price: 99.0, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "5/6 ARM Conforming", rate: 6.0, price: 98.75, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "5/6 ARM Conforming", rate: 6.125, price: 98.5, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "5/6 ARM Conforming", rate: 6.25, price: 98.25, when: 'loanType == "arm" and loanAmount <= 806500' },
];

/** 5/6 SOFR ARM Jumbo */
export const THUNDER_BASE_RATES_5_6_ARM_JUMBO: BaseRate[] = [
  { category: "5/6 ARM Jumbo", rate: 5.75, price: 99.25, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "5/6 ARM Jumbo", rate: 5.875, price: 99.0, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "5/6 ARM Jumbo", rate: 6.0, price: 98.75, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "5/6 ARM Jumbo", rate: 6.125, price: 98.5, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "5/6 ARM Jumbo", rate: 6.25, price: 98.25, when: 'loanType == "arm" and loanAmount > 806500' },
];

/** 7/6 SOFR ARM Conforming */
export const THUNDER_BASE_RATES_7_6_ARM_CONFORMING: BaseRate[] = [
  { category: "7/6 ARM Conforming", rate: 6.125, price: 99.25, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "7/6 ARM Conforming", rate: 6.25, price: 99.0, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "7/6 ARM Conforming", rate: 6.375, price: 98.75, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "7/6 ARM Conforming", rate: 6.5, price: 98.5, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "7/6 ARM Conforming", rate: 6.625, price: 98.25, when: 'loanType == "arm" and loanAmount <= 806500' },
];

/** 7/6 SOFR ARM Jumbo */
export const THUNDER_BASE_RATES_7_6_ARM_JUMBO: BaseRate[] = [
  { category: "7/6 ARM Jumbo", rate: 6.25, price: 99.25, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "7/6 ARM Jumbo", rate: 6.375, price: 99.0, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "7/6 ARM Jumbo", rate: 6.5, price: 98.75, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "7/6 ARM Jumbo", rate: 6.625, price: 98.5, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "7/6 ARM Jumbo", rate: 6.75, price: 98.25, when: 'loanType == "arm" and loanAmount > 806500' },
];

/** 10/6 SOFR ARM Conforming */
export const THUNDER_BASE_RATES_10_6_ARM_CONFORMING: BaseRate[] = [
  { category: "10/6 ARM Conforming", rate: 6.375, price: 99.25, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "10/6 ARM Conforming", rate: 6.5, price: 99.0, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "10/6 ARM Conforming", rate: 6.625, price: 98.75, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "10/6 ARM Conforming", rate: 6.75, price: 98.5, when: 'loanType == "arm" and loanAmount <= 806500' },
  { category: "10/6 ARM Conforming", rate: 6.875, price: 98.25, when: 'loanType == "arm" and loanAmount <= 806500' },
];

/** 10/6 SOFR ARM Jumbo */
export const THUNDER_BASE_RATES_10_6_ARM_JUMBO: BaseRate[] = [
  { category: "10/6 ARM Jumbo", rate: 6.5, price: 99.25, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "10/6 ARM Jumbo", rate: 6.625, price: 99.0, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "10/6 ARM Jumbo", rate: 6.75, price: 98.75, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "10/6 ARM Jumbo", rate: 6.875, price: 98.5, when: 'loanType == "arm" and loanAmount > 806500' },
  { category: "10/6 ARM Jumbo", rate: 7.0, price: 98.25, when: 'loanType == "arm" and loanAmount > 806500' },
];

/** 所有基准利率 */
export const THUNDER_BASE_RATES: BaseRate[] = [
  // Fixed Conforming
  ...THUNDER_BASE_RATES_10_FIXED_CONFORMING,
  ...THUNDER_BASE_RATES_15_FIXED_CONFORMING,
  ...THUNDER_BASE_RATES_20_FIXED_CONFORMING,
  ...THUNDER_BASE_RATES_30_FIXED_CONFORMING,
  // Fixed Jumbo
  ...THUNDER_BASE_RATES_10_FIXED_JUMBO,
  ...THUNDER_BASE_RATES_15_FIXED_JUMBO,
  ...THUNDER_BASE_RATES_20_FIXED_JUMBO,
  ...THUNDER_BASE_RATES_30_FIXED_JUMBO,
  // ARM Conforming
  ...THUNDER_BASE_RATES_3_6_ARM_CONFORMING,
  ...THUNDER_BASE_RATES_5_6_ARM_CONFORMING,
  ...THUNDER_BASE_RATES_7_6_ARM_CONFORMING,
  ...THUNDER_BASE_RATES_10_6_ARM_CONFORMING,
  // ARM Jumbo
  ...THUNDER_BASE_RATES_3_6_ARM_JUMBO,
  ...THUNDER_BASE_RATES_5_6_ARM_JUMBO,
  ...THUNDER_BASE_RATES_7_6_ARM_JUMBO,
  ...THUNDER_BASE_RATES_10_6_ARM_JUMBO,
];

// ============================================================================
// LLPA 矩阵数据
// ============================================================================

const RATE_SHEET_DOC_PATH =
  "thunder/rate-sheets/GMCC Thunder Rate Sheet 12.23.2025.md";

// 共用的 FICO 范围定义（Conforming）
const CONFORMING_FICO_RANGES: readonly LLPARange[] = [
  { label: ">=780", min: 780, max: Infinity },
  { label: "760-779", min: 760, max: 779 },
  { label: "740-759", min: 740, max: 759 },
  { label: "720-739", min: 720, max: 739 },
  { label: "700-719", min: 700, max: 719 },
  { label: "680-699", min: 680, max: 699 },
];

// 共用的 LTV 范围定义（Conforming，9 列）
const CONFORMING_LTV_RANGES: readonly LLPARange[] = [
  { label: "<=30", min: 0, max: 30 },
  { label: "30.01-60", min: 30.01, max: 60 },
  { label: "60.01-70", min: 60.01, max: 70 },
  { label: "70.01-75", min: 70.01, max: 75 },
  { label: "75.01-80", min: 75.01, max: 80 },
  { label: "80.01-85", min: 80.01, max: 85 },
  { label: "85.01-90", min: 85.01, max: 90 },
  { label: "90.01-95", min: 90.01, max: 95 },
  { label: ">95", min: 95.01, max: Infinity },
];

// Cash-Out 的 LTV 范围（只到 80%）
const CASHOUT_LTV_RANGES: readonly LLPARange[] = [
  { label: "<=30", min: 0, max: 30 },
  { label: "30.01-60", min: 30.01, max: 60 },
  { label: "60.01-70", min: 60.01, max: 70 },
  { label: "70.01-75", min: 70.01, max: 75 },
  { label: "75.01-80", min: 75.01, max: 80 },
];

/** Conforming Purchase LLPA 矩阵 */
const CONFORMING_PURCHASE_LLPA: LLPAMatrix = {
  name: "Conforming Purchase LLPA",
  when: 'loanAmount <= 806500 and loanTerm > 15 and loanPurpose == "purchase"',
  ficoRanges: CONFORMING_FICO_RANGES,
  ltvRanges: CONFORMING_LTV_RANGES,
  // 行：FICO（从高到低），列：LTV（从低到高）
  // 值来自 Rate Sheet 247-258 行
  values: [
    // <=30   30-60  60-70  70-75  75-80  80-85  85-90  90-95  >95
    [0, 0, 0, 0, 0.375, 0.375, 0.25, 0.25, 0.125], // >=780
    [0, 0, 0, 0.25, 0.625, 0.625, 0.5, 0.5, 0.25], // 760-779
    [0, 0, 0.125, 0.375, 0.875, 1.0, 0.75, 0.625, 0.5], // 740-759
    [0, 0, 0.25, 0.75, 1.25, 1.25, 1.0, 0.875, 0.75], // 720-739
    [0, 0, 0.375, 0.875, 1.375, 1.5, 1.25, 1.125, 0.875], // 700-719
    [0, 0, 0.625, 1.125, 1.75, 1.875, 1.5, 1.375, 1.125], // 680-699
  ],
  adjustmentType: "fee",
  citation: {
    quote: "### Conforming Loan (≤ $806,500) - Purchases",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 247, end: 258 },
  },
};

/** Conforming Refinance LLPA 矩阵 */
const CONFORMING_REFINANCE_LLPA: LLPAMatrix = {
  name: "Conforming Refinance LLPA",
  when: 'loanAmount <= 806500 and loanTerm > 15 and loanPurpose == "refinance"',
  ficoRanges: CONFORMING_FICO_RANGES,
  ltvRanges: CONFORMING_LTV_RANGES,
  // 值来自 Rate Sheet 260-271 行
  values: [
    // <=30   30-60  60-70  70-75  75-80  80-85  85-90  90-95  >95
    [0, 0, 0, 0.125, 0.5, 0.625, 0.5, 0.375, 0.375], // >=780
    [0, 0, 0.125, 0.375, 0.875, 1.0, 0.75, 0.625, 0.625], // 760-779
    [0, 0, 0.25, 0.75, 1.125, 1.375, 1.125, 1.0, 1.0], // 740-759
    [0, 0, 0.5, 1.0, 1.625, 1.75, 1.5, 1.25, 1.25], // 720-739
    [0, 0, 0.625, 1.25, 1.875, 2.125, 1.75, 1.625, 1.625], // 700-719
    [0, 0, 0.875, 1.625, 2.25, 2.5, 2.125, 1.75, 1.75], // 680-699
  ],
  adjustmentType: "fee",
  citation: {
    quote: "### Conforming Loan (≤ $806,500) - Refinances",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 260, end: 271 },
  },
};

/** Conforming Cash-Out LLPA 矩阵 */
const CONFORMING_CASHOUT_LLPA: LLPAMatrix = {
  name: "Conforming Cash-Out LLPA",
  when: 'loanAmount <= 806500 and loanPurpose == "cashOut"',
  ficoRanges: CONFORMING_FICO_RANGES,
  ltvRanges: CASHOUT_LTV_RANGES,
  // 值来自 Rate Sheet 278-283 行
  values: [
    // <=30   30-60  60-70  70-75  75-80
    [0.375, 0.375, 0.625, 0.875, 1.375], // >=780
    [0.375, 0.375, 0.875, 1.25, 1.875], // 760-779
    [0.375, 0.375, 1.0, 1.625, 2.375], // 740-759
    [0.375, 0.5, 1.375, 2.0, 2.75], // 720-739
    [0.375, 0.5, 1.625, 2.625, 3.25], // 700-719
    [0.375, 0.625, 2.0, 2.875, 3.75], // 680-699
  ],
  adjustmentType: "fee",
  citation: {
    quote: "| Cash-Out (≥780) | ... | Cash-Out (FICO 680-699) |",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 278, end: 283 },
  },
};

/** 所有 LLPA 矩阵 */
export const THUNDER_LLPA_MATRICES: readonly LLPAMatrix[] = [
  CONFORMING_PURCHASE_LLPA,
  CONFORMING_REFINANCE_LLPA,
  CONFORMING_CASHOUT_LLPA,
];

// ============================================================================
// 非矩阵调整项
// ============================================================================

/**
 * Thunder 定价调整项（非矩阵规则）
 *
 * 这些规则无法用 FICO × LTV 矩阵表示，保留传统格式
 */
export const THUNDER_ADJUSTMENTS: Adjustment[] = [
  // ============================================================================
  // Conforming Other Adjustments
  // ============================================================================

  // ARM adjustment (Conforming) - 只有高 LTV 有调整
  {
    name: "ARM LTV 90.01-95% (Conforming)",
    when: 'loanAmount <= 806500 and loanType == "arm" and ltv > 90 and ltv <= 95',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Adjustable Rate Mortgage | ... | 0.250% | 0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 277, end: 277 },
      },
    ],
  },
  {
    name: "ARM LTV > 95% (Conforming)",
    when: 'loanAmount <= 806500 and loanType == "arm" and ltv > 95',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Adjustable Rate Mortgage | ... | 0.250% | 0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 277, end: 277 },
      },
    ],
  },

  // Condominium (Conforming)
  {
    name: "Condominium LTV 60.01-75% (Conforming)",
    when: 'loanAmount <= 806500 and propertyType == "condo" and ltv > 60 and ltv <= 75',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| Condominium | ... | 0.125% | 0.125% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 284, end: 284 },
      },
    ],
  },
  {
    name: "Condominium LTV > 75% (Conforming)",
    when: 'loanAmount <= 806500 and propertyType == "condo" and ltv > 75',
    priceAdj: -0.75,
    citations: [
      {
        quote: "| Condominium | ... | 0.750% | 0.750% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 284, end: 284 },
      },
    ],
  },

  // Second Home (Conforming)
  {
    name: "Second Home LTV <=60% (Conforming)",
    when: 'loanAmount <= 806500 and occupancy == "secondHome" and ltv <= 60',
    priceAdj: -1.125,
    citations: [
      {
        quote: "| Second Home | 1.125% | 1.125% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 285, end: 285 },
      },
    ],
  },
  {
    name: "Second Home LTV 60.01-70% (Conforming)",
    when: 'loanAmount <= 806500 and occupancy == "secondHome" and ltv > 60 and ltv <= 70',
    priceAdj: -1.625,
    citations: [
      {
        quote: "| Second Home | ... | 1.625% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 285, end: 285 },
      },
    ],
  },
  {
    name: "Second Home LTV 70.01-75% (Conforming)",
    when: 'loanAmount <= 806500 and occupancy == "secondHome" and ltv > 70 and ltv <= 75',
    priceAdj: -2.125,
    citations: [
      {
        quote: "| Second Home | ... | 2.125% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 285, end: 285 },
      },
    ],
  },
  {
    name: "Second Home LTV 75.01-80% (Conforming)",
    when: 'loanAmount <= 806500 and occupancy == "secondHome" and ltv > 75 and ltv <= 80',
    priceAdj: -3.375,
    citations: [
      {
        quote: "| Second Home | ... | 3.375% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 285, end: 285 },
      },
    ],
  },
  {
    name: "Second Home LTV > 80% (Conforming)",
    when: 'loanAmount <= 806500 and occupancy == "secondHome" and ltv > 80',
    priceAdj: -4.125,
    citations: [
      {
        quote: "| Second Home | ... | 4.125% | 4.125% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 285, end: 285 },
      },
    ],
  },

  // Subordinate Financing (Conforming)
  {
    name: "Subordinate Financing LTV <=75% (Conforming)",
    when: "loanAmount <= 806500 and hasSubordinateFinancing and ltv <= 75",
    priceAdj: -0.625,
    citations: [
      {
        quote: "| Subordinate Financing | 0.625% | 0.625% | 0.625% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 286, end: 286 },
      },
    ],
  },
  {
    name: "Subordinate Financing LTV 75.01-80% (Conforming)",
    when: "loanAmount <= 806500 and hasSubordinateFinancing and ltv > 75 and ltv <= 80",
    priceAdj: -0.875,
    citations: [
      {
        quote: "| Subordinate Financing | ... | 0.875% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 286, end: 286 },
      },
    ],
  },
  {
    name: "Subordinate Financing LTV 80.01-90% (Conforming)",
    when: "loanAmount <= 806500 and hasSubordinateFinancing and ltv > 80 and ltv <= 90",
    priceAdj: -1.125,
    citations: [
      {
        quote: "| Subordinate Financing | ... | 1.125% | 1.125% | 1.125% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 286, end: 286 },
      },
    ],
  },
  {
    name: "Subordinate Financing LTV > 90% (Conforming)",
    when: "loanAmount <= 806500 and hasSubordinateFinancing and ltv > 90",
    priceAdj: -1.875,
    citations: [
      {
        quote: "| Subordinate Financing | ... | 1.875% | 1.875% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 286, end: 286 },
      },
    ],
  },

  // ============================================================================
  // Jumbo Refinance LLPA
  // ============================================================================

  {
    name: "Jumbo Refinance LTV 70.01-75%",
    when: 'loanAmount > 806500 and loanPurpose == "refinance" and ltv > 70 and ltv <= 75',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| All | 0.000% | 0.000% | 0.125% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 300, end: 300 },
      },
    ],
  },
  {
    name: "Jumbo Refinance LTV 75.01-80%",
    when: 'loanAmount > 806500 and loanPurpose == "refinance" and ltv > 75 and ltv <= 80',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| All | ... | 0.250% | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 300, end: 300 },
      },
    ],
  },

  // ============================================================================
  // Jumbo Fixed Fee Adjustments
  // ============================================================================

  {
    name: "Cash-Out LTV <=70% (Jumbo Fixed)",
    when: 'loanAmount > 806500 and loanType == "fixed" and loanPurpose == "cashOut" and ltv <= 70',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| Cash-Out | 0.375% | 0.375% | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 306, end: 306 },
      },
    ],
  },
  {
    name: "Second Home LTV <=70% (Jumbo Fixed)",
    when: 'loanAmount > 806500 and loanType == "fixed" and occupancy == "secondHome" and ltv <= 70',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| Second Home | 0.125% | 0.125% | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 307, end: 307 },
      },
    ],
  },
  {
    name: "Condominium LTV 70.01-75% (Jumbo Fixed)",
    when: 'loanAmount > 806500 and loanType == "fixed" and propertyType == "condo" and ltv > 70 and ltv <= 75',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Condominium | 0.000% | 0.000% | 0.250% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 308, end: 308 },
      },
    ],
  },
  {
    name: "Condominium LTV 75.01-80% (Jumbo Fixed)",
    when: 'loanAmount > 806500 and loanType == "fixed" and propertyType == "condo" and ltv > 75 and ltv <= 80',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Condominium | ... | 0.500% | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 308, end: 308 },
      },
    ],
  },
  {
    name: "Loan Amount > $1.5M, LTV <=75% (Jumbo Fixed)",
    when: 'loanAmount > 1500000 and loanType == "fixed" and ltv <= 75',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| Loan Amount > $1.5M | 0.125% | 0.125% | 0.125% | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 309, end: 309 },
      },
    ],
  },

  // ============================================================================
  // Jumbo ARM Fee Adjustments
  // ============================================================================

  {
    name: "Cash-Out LTV <=70% (Jumbo ARM)",
    when: 'loanAmount > 806500 and loanType == "arm" and loanPurpose == "cashOut" and ltv <= 70',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| Cash-Out | 0.375% | 0.375% | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 315, end: 315 },
      },
    ],
  },
  {
    name: "Second Home LTV <=70% (Jumbo ARM)",
    when: 'loanAmount > 806500 and loanType == "arm" and occupancy == "secondHome" and ltv <= 70',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| Second Home | 0.125% | 0.125% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 316, end: 316 },
      },
    ],
  },
  {
    name: "Second Home LTV 70.01-75% (Jumbo ARM)",
    when: 'loanAmount > 806500 and loanType == "arm" and occupancy == "secondHome" and ltv > 70 and ltv <= 75',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Second Home | ... | 0.250% | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 316, end: 316 },
      },
    ],
  },
  {
    name: "Condominium LTV 70.01-75% (Jumbo ARM)",
    when: 'loanAmount > 806500 and loanType == "arm" and propertyType == "condo" and ltv > 70 and ltv <= 75',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Condominium | 0.000% | 0.000% | 0.250% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 317, end: 317 },
      },
    ],
  },
  {
    name: "Condominium LTV > 75% (Jumbo ARM)",
    when: 'loanAmount > 806500 and loanType == "arm" and propertyType == "condo" and ltv > 75',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Condominium | ... | 0.500% | 0.500% | 0.500% | 0.500% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 317, end: 317 },
      },
    ],
  },
  {
    name: "Interest Only 5/6 ARM LTV <=65% (Jumbo)",
    when: 'loanAmount > 806500 and isInterestOnly and armTerm == "5/6" and ltv <= 65',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Interest Only (5/6 ARM) | 0.500% | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 318, end: 318 },
      },
    ],
  },

  // ============================================================================
  // MI Program Rate Adjustment
  // ============================================================================

  {
    name: "MI Program LTV 80.01-90% (Conforming)",
    when: "loanAmount <= 806500 and ltv > 80 and ltv <= 90",
    rateAdj: 0.125,
    citations: [
      {
        quote: "**Conforming**: +0.125% rate",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 337, end: 337 },
      },
    ],
  },
  {
    name: "MI Program LTV 80.01-90% (Jumbo)",
    when: "loanAmount > 806500 and ltv > 80 and ltv <= 90",
    rateAdj: 0.125,
    citations: [
      {
        quote: "**Jumbo** ... : +0.125% rate",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 338, end: 338 },
      },
    ],
  },

  // ============================================================================
  // Special Rate Discount (Jumbo 3/6 and 5/6 only)
  // ============================================================================

  {
    name: "Special Rate Discount LTV <=55% (Jumbo 3/6 or 5/6)",
    when: 'loanAmount > 806500 and loanType == "arm" and (armTerm == "3/6" or armTerm == "5/6") and ltv <= 55',
    rateAdj: -0.25,
    citations: [
      {
        quote: "If LTV ≤ 55%: -0.250 Rate",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 344, end: 344 },
      },
    ],
  },
  {
    name: "Special Rate Discount LTV 55.01-65% (Jumbo 3/6 or 5/6)",
    when: 'loanAmount > 806500 and loanType == "arm" and (armTerm == "3/6" or armTerm == "5/6") and ltv > 55 and ltv <= 65',
    rateAdj: -0.125,
    citations: [
      {
        quote: "If LTV ≤ 65%: -0.125 Rate",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 343, end: 343 },
      },
    ],
  },
];

// ============================================================================
// 延期费用
// ============================================================================

/**
 * 延期费用
 *
 * Thunder 特殊规则：
 * - 最低 10 天延期，收取 0.10%
 * - 第 11 天起，每天额外收取 0.03%
 *
 * 预计算常见天数的费用
 */
export const THUNDER_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 10, cost: 0.1, category: "all" },
  { days: 15, cost: 0.25, category: "all" }, // 0.10 + 5 * 0.03
  { days: 20, cost: 0.4, category: "all" }, // 0.10 + 10 * 0.03
  { days: 30, cost: 0.7, category: "all" }, // 0.10 + 20 * 0.03
];

// ============================================================================
// 锁定期调整
// ============================================================================

/**
 * 锁定期价格调整
 *
 * 30-Day 为基准，45-Day 和 60-Day 有不同的价格
 * 计算方式：以 30-Day 的价格折扣为基准
 * - 30-Day: (0.750) → 基准
 * - 45-Day: (0.625) → 比 30-Day 少 0.125 折扣
 * - 60-Day: (0.500) → 比 30-Day 少 0.25 折扣
 */
export const THUNDER_LOCK_DAY_PRICES: Record<number, LockDayPrice> = {
  30: { adjustment: 0 },
  45: { adjustment: -0.125 }, // 价格降低 0.125
  60: { adjustment: -0.25 }, // 价格降低 0.25
};

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 */
export const THUNDER_REQUIRED_FIELDS = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score (680-850)",
    example: 720,
  },
  ltv: {
    type: "number",
    description: "Loan-to-Value ratio (percentage, e.g., 70 for 70%)",
    example: 70,
  },
  loanAmount: {
    type: "number",
    description:
      "Loan amount in dollars (≤806500 for Conforming, >806500 for Jumbo)",
    example: 500000,
  },
  loanPurpose: {
    type: "enum",
    values: ["purchase", "refinance", "cashOut"],
    description: "Loan purpose",
    example: "purchase",
  },
  loanType: {
    type: "enum",
    values: ["fixed", "arm"],
    description: "Loan type. Default: arm (lowest rates)",
    example: "arm",
    defaultValue: "arm",
  },
  loanTerm: {
    type: "number",
    description: "Loan term in years (10, 15, 20, 30)",
    example: 30,
  },
  armTerm: {
    type: "enum",
    values: ["3/6", "5/6", "7/6", "10/6"],
    description: "ARM term (only for ARM loans)",
    example: "5/6",
  },
  occupancy: {
    type: "enum",
    values: ["primary", "secondHome", "investment"],
    description: "Property occupancy type",
    example: "primary",
  },
  propertyType: {
    type: "enum",
    values: ["sfr", "pud", "condo", "multiUnit"],
    description: "Property type",
    example: "sfr",
  },
  hasSubordinateFinancing: {
    type: "boolean",
    description: "Whether there is subordinate financing (CLTV > LTV)",
    example: false,
  },
  isInterestOnly: {
    type: "boolean",
    description: "Whether the loan is interest-only (5/6 Jumbo ARM only)",
    example: false,
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

/**
 * Thunder 产品完整定价配置
 */
export const THUNDER_PRICING_CONFIG = {
  productName: THUNDER_RATE_SHEET.productName,
  baseRates: THUNDER_BASE_RATES,
  adjustments: THUNDER_ADJUSTMENTS,
  llpaMatrices: THUNDER_LLPA_MATRICES,
  stackingRules: [],
  extensionCosts: THUNDER_EXTENSION_COSTS,
  rateSheets: THUNDER_RATE_SHEET.rateSheets,
  lockDayPrices: THUNDER_LOCK_DAY_PRICES,
} as const;
