/**
 * Radiant CRA (Community Reinvestment Act) 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 priceRadiantCra 工具使用
 *
 * 来源: GMCC Radiant Rate Sheet 1.2.2026.pdf (Page 3)
 *
 * CRA 特点：
 * - 符合 CRA 要求的社区贷款（LMI 区域）
 * - 支持 30 Yr Fixed 和 7/6 ARM
 * - 手动核保（No AUS required）
 * - 调整是 RATE 调整（rateAdj）
 */

import type { BaseRate, Adjustment, ExtensionCost, PricingFieldDef } from "../types";

// ============================================================================
// 元信息
// ============================================================================

export const RADIANT_CRA_RATE_SHEET = {
  productName: "Radiant CRA",
  effectiveDate: "2026-01-02",
  margin: 3.0, // ARM only
  index: "30 Day Average SOFR", // ARM only
  lockPeriod: 45, // 45 days initial
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/radiant/rate-sheets/GMCC Radiant Rate Sheet 1.2.2026.pdf",
      title: "GMCC Radiant Rate Sheet 1.2.2026 - Page 3",
    },
  ],
} as const;

// ============================================================================
// 基准利率
// ============================================================================

/**
 * 30 Yr Fixed 基准利率
 */
export const RADIANT_CRA_BASE_RATES_30_FIXED: BaseRate[] = [
  { category: "30 Year Fixed", rate: 6.0, price: 99.75 },
];

/**
 * 7/6 mo. ARM 5/1/5 基准利率
 */
export const RADIANT_CRA_BASE_RATES_7_6_ARM: BaseRate[] = [
  { category: "7/6 ARM", rate: 5.75, price: 99.75 },
];

/**
 * 所有基准利率
 */
export const RADIANT_CRA_BASE_RATES: BaseRate[] = [
  ...RADIANT_CRA_BASE_RATES_30_FIXED,
  ...RADIANT_CRA_BASE_RATES_7_6_ARM,
];

// ============================================================================
// 定价调整项
// ============================================================================

const RATE_SHEET_DOC_PATH = "radiant/rate-sheets/cra-matrix.md";

/**
 * Radiant CRA 定价调整项
 *
 * 重要：CRA 的调整是 RATE 调整（rateAdj），不是 price 调整！
 * 30 Yr Fixed 和 7/6 ARM 使用相同的调整项
 */
export const RADIANT_CRA_ADJUSTMENTS: Adjustment[] = [
  // ============================================================================
  // Loan Purpose 调整
  // ============================================================================
  {
    name: "Cash-Out",
    when: 'loanPurpose == "cashOut"',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Cash Out | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 40, end: 40 },
      },
    ],
  },

  // ============================================================================
  // Occupancy 调整
  // ============================================================================
  {
    name: "Investment",
    when: 'occupancy == "investment"',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Investment | 0.250% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 41, end: 41 },
      },
    ],
  },

  // ============================================================================
  // Units 调整
  // ============================================================================
  {
    name: "2-4 Units",
    when: "units >= 2 and units <= 4",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| 2 to 4 Unit | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 42, end: 42 },
      },
    ],
  },

  // ============================================================================
  // Employment 调整
  // ============================================================================
  {
    name: "Short Employment History",
    when: "hasShortEmploymentHistory",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Same line of work less than two years or extended employment gap** | 0.125% to Rate or 0.50% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 43, end: 43 },
      },
    ],
  },

  // ============================================================================
  // Property Type 调整
  // ============================================================================
  {
    name: "Condominium",
    when: 'propertyType == "condo"',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Condominium | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 44, end: 44 },
      },
    ],
  },

  // ============================================================================
  // FICO 调整
  // ============================================================================
  {
    name: "FICO 640-679",
    when: "ficoScore >= 640 and ficoScore <= 679",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| 640 to 679 FICO | 0.250% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 45, end: 45 },
      },
    ],
  },
  {
    name: "FICO 680-699",
    when: "ficoScore >= 680 and ficoScore <= 699",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| 680 to 699 FICO | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 46, end: 46 },
      },
    ],
  },

  // ============================================================================
  // Credit 调整
  // ============================================================================
  {
    name: "Non-Traditional Credit with Derogatories",
    when: "hasNonTraditionalCreditDerogatories",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Non-Traditional Credit with derogatories | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 47, end: 47 },
      },
    ],
  },

  // ============================================================================
  // Exception 调整
  // ============================================================================
  {
    name: "Any Exception",
    when: "hasException",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Any Exception | 0.125% to Rate or 0.50% to Fee |",
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
export const RADIANT_CRA_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 7, cost: 0.125, category: "all" },
  { days: 15, cost: 0.25, category: "all" },
];

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 */
export const RADIANT_CRA_REQUIRED_FIELDS: Record<string, PricingFieldDef> = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score (min 640)",
    example: 700,
  },
  loanPurpose: {
    type: "enum",
    values: ["purchase", "refinance", "cashOut"],
    description: "Loan purpose (30 Yr Fixed: Purchase/R&T only)",
    example: "purchase",
  },
  occupancy: {
    type: "enum",
    values: ["primary", "investment"],
    description: "Property occupancy type (Primary or Investment only)",
    example: "primary",
  },
  propertyType: {
    type: "enum",
    values: ["sfr", "pud", "condo"],
    description: "Property type",
    example: "sfr",
  },
  units: {
    type: "number",
    description: "Number of units (1-4)",
    example: 1,
  },
  hasShortEmploymentHistory: {
    type: "boolean",
    description: "Same line of work < 2 years or extended employment gap",
    example: false,
  },
  hasNonTraditionalCreditDerogatories: {
    type: "boolean",
    description: "Non-traditional credit with derogatories",
    example: false,
  },
  hasException: {
    type: "boolean",
    description: "Any exception to standard guidelines",
    example: false,
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

/**
 * Radiant CRA 产品完整定价配置
 */
export const RADIANT_CRA_PRICING_CONFIG = {
  productName: RADIANT_CRA_RATE_SHEET.productName,
  baseRates: RADIANT_CRA_BASE_RATES,
  adjustments: RADIANT_CRA_ADJUSTMENTS,
  stackingRules: [],
  extensionCosts: RADIANT_CRA_EXTENSION_COSTS,
  rateSheets: RADIANT_CRA_RATE_SHEET.rateSheets,
} as const;
