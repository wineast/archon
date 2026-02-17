/**
 * Ocean 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 runPricingSOP 工具使用
 *
 * 来源: GMCC Ocean Rate Sheet 12.18.2025.pdf
 *
 * 注意：Ocean 的调整是 RATE 调整（rateAdj），不是 price 调整
 */

import type { BaseRate, Adjustment, ExtensionCost } from "../types";

// ============================================================================
// 元信息
// ============================================================================

export const OCEAN_RATE_SHEET = {
  productName: "Ocean",
  effectiveDate: "2025-12-18",
  margin: 3.0,
  index: "30 DAY SOFR",
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/ocean/rate-sheets/GMCC Ocean Rate Sheet 12.18.2025.pdf",
      title: "GMCC Ocean Rate Sheet 12.18.2025",
    },
  ],
} as const;

// ============================================================================
// 基准利率
// ============================================================================

/**
 * 5/6 Month ARM (2/1/6 Caps) 基准利率
 */
export const OCEAN_BASE_RATES_5_6_ARM: BaseRate[] = [
  { category: "5/6 ARM", rate: 5.875, price: 100 },
  { category: "5/6 ARM", rate: 6.0, price: 100.125 },
  { category: "5/6 ARM", rate: 6.125, price: 100.25 },
  { category: "5/6 ARM", rate: 6.25, price: 100.375 },
  { category: "5/6 ARM", rate: 6.375, price: 100.5 },
];

/**
 * 7/6 Month ARM (5/1/6 Caps) 基准利率
 */
export const OCEAN_BASE_RATES_7_6_ARM: BaseRate[] = [
  { category: "7/6 ARM", rate: 6.125, price: 100 },
  { category: "7/6 ARM", rate: 6.25, price: 100.125 },
  { category: "7/6 ARM", rate: 6.375, price: 100.25 },
  { category: "7/6 ARM", rate: 6.5, price: 100.375 },
  { category: "7/6 ARM", rate: 6.625, price: 100.5 },
];

/**
 * 所有基准利率
 */
export const OCEAN_BASE_RATES: BaseRate[] = [
  ...OCEAN_BASE_RATES_5_6_ARM,
  ...OCEAN_BASE_RATES_7_6_ARM,
];

// ============================================================================
// 定价调整项
// ============================================================================

const RATE_SHEET_DOC_PATH = "ocean/rate-sheets/GMCC Ocean Rate Sheet 12.18.2025.md";

/**
 * Ocean 定价调整项
 *
 * 重要：Ocean 的调整是 RATE 调整（rateAdj），不是 price 调整！
 *
 * 特殊规则：
 * - FICO adjuster is NOT applicable for Foreign Program
 * - Second Home adjuster is NOT applicable for Foreign Program
 */
export const OCEAN_ADJUSTMENTS: Adjustment[] = [
  // Cash Out 调整（互斥）
  {
    name: "Cash Out > 50% LTV",
    when: 'loanPurpose == "cashOut" and ltv > 50',
    rateAdj: 0.375,
    citations: [
      {
        quote: "| Cash out > 50% | +0.375% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 41, end: 41 },
      },
    ],
  },
  {
    name: "Cash Out ≤ 50% LTV",
    when: 'loanPurpose == "cashOut" and ltv <= 50',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Cash out ≤ 50% | +0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 42, end: 42 },
      },
    ],
  },

  // Property Type 调整
  {
    name: "2-4 Units",
    when: "units >= 2 and units <= 4",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| 2-4 Units | +0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 43, end: 43 },
      },
    ],
  },
  {
    name: "Condominium LTV > 60%",
    when: 'propertyType == "condo" and ltv > 60',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Condominium LTV > 60% | +0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 44, end: 44 },
      },
    ],
  },

  // FICO 调整（不适用于 Foreign Program）
  {
    name: "FICO < 700",
    when: "ficoScore < 700 and not isForeignNational",
    rateAdj: 0.375,
    citations: [
      {
        quote: "| FICO < 700 | +0.375% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 45, end: 45 },
      },
      {
        quote: "FICO adjuster is NOT applicable for Foreign Program",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 52, end: 52 },
      },
    ],
  },

  // Occupancy 调整（不适用于 Foreign Program）
  {
    name: "Second Home / NOO",
    when: '(occupancy == "secondHome" or occupancy == "investment") and not isForeignNational',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Second Home / Non-Owner Occupied | +0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 46, end: 46 },
      },
      {
        quote: "Second Home adjuster is NOT applicable for Foreign Program",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 53, end: 53 },
      },
    ],
  },

  // Foreign Program
  {
    name: "Foreign Program",
    when: "isForeignNational",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Foreign Program | +0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 47, end: 47 },
      },
    ],
  },

  // 优惠调整
  {
    name: "Purchase LTV ≤ 60%",
    when: 'loanPurpose == "purchase" and ltv <= 60',
    rateAdj: -0.25,
    citations: [
      {
        quote: "| Purchase Transaction LTV ≤ 60% | -0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 48, end: 48 },
      },
    ],
  },
];

// ============================================================================
// 延期费用
// ============================================================================

/**
 * 延期费用（price 调整）
 */
export const OCEAN_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 7, cost: 0.125, category: "5/6 ARM" },
  { days: 7, cost: 0.125, category: "7/6 ARM" },
  { days: 15, cost: 0.25, category: "5/6 ARM" },
  { days: 15, cost: 0.25, category: "7/6 ARM" },
];

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 */
export const OCEAN_REQUIRED_FIELDS = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score",
    example: 720,
  },
  ltv: {
    type: "number",
    description: "Loan-to-Value ratio (percentage, e.g., 70 for 70%)",
    example: 70,
  },
  loanPurpose: {
    type: "enum",
    values: ["purchase", "refinance", "cashOut"],
    description: "Loan purpose",
    example: "purchase",
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
  units: {
    type: "number",
    description: "Number of units (1-4)",
    example: 1,
  },
  isForeignNational: {
    type: "boolean",
    description: "Whether borrower is a foreign national",
    example: false,
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

/**
 * Ocean 产品完整定价配置
 */
export const OCEAN_PRICING_CONFIG = {
  productName: OCEAN_RATE_SHEET.productName,
  baseRates: OCEAN_BASE_RATES,
  adjustments: OCEAN_ADJUSTMENTS,
  stackingRules: [],
  extensionCosts: OCEAN_EXTENSION_COSTS,
  rateSheets: OCEAN_RATE_SHEET.rateSheets,
} as const;
