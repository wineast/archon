/**
 * Radiant Portfolio 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 priceRadiantPortfolio 工具使用
 *
 * 来源: GMCC Radiant Rate Sheet 1.2.2026.pdf (Page 2)
 *
 * Portfolio 特点：
 * - 支持 5/6 ARM 和 30 Yr Fixed
 * - Alternative Documentation（WVOE、Self-Employed P&L）
 * - 调整是 RATE 调整（rateAdj）
 */

import type { BaseRate, Adjustment, ExtensionCost, PricingFieldDef } from "../types";

// ============================================================================
// 元信息
// ============================================================================

export const RADIANT_PORTFOLIO_RATE_SHEET = {
  productName: "Radiant Portfolio",
  effectiveDate: "2026-01-02",
  margin: 3.0, // ARM only
  index: "30 Day Average SOFR", // ARM only
  lockPeriod: 30, // 30 days initial
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/radiant/rate-sheets/GMCC Radiant Rate Sheet 1.2.2026.pdf",
      title: "GMCC Radiant Rate Sheet 1.2.2026 - Page 2",
    },
  ],
} as const;

// ============================================================================
// 基准利率
// ============================================================================

/**
 * 5/6 mo. ARM 2/1/5 基准利率
 */
export const RADIANT_PORTFOLIO_BASE_RATES_5_6_ARM: BaseRate[] = [
  { category: "5/6 ARM", rate: 5.875, price: 99.75 },
  { category: "5/6 ARM", rate: 5.75, price: 99.25 },
];

/**
 * 30 Yr Fixed 基准利率
 */
export const RADIANT_PORTFOLIO_BASE_RATES_30_FIXED: BaseRate[] = [
  { category: "30 Year Fixed", rate: 6.125, price: 99.75 },
  { category: "30 Year Fixed", rate: 6.0, price: 99.25 },
];

/**
 * 所有基准利率
 */
export const RADIANT_PORTFOLIO_BASE_RATES: BaseRate[] = [
  ...RADIANT_PORTFOLIO_BASE_RATES_5_6_ARM,
  ...RADIANT_PORTFOLIO_BASE_RATES_30_FIXED,
];

// ============================================================================
// 定价调整项
// ============================================================================

const RATE_SHEET_DOC_PATH = "radiant/rate-sheets/portfolio-matrix.md";

/**
 * Radiant Portfolio 定价调整项
 *
 * 重要：Portfolio 的调整是 RATE 调整（rateAdj），不是 price 调整！
 */
export const RADIANT_PORTFOLIO_ADJUSTMENTS: Adjustment[] = [
  // ============================================================================
  // Occupancy 调整
  // ============================================================================
  {
    name: "Investment",
    when: 'occupancy == "investment"',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Investment | 0.25% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 45, end: 45 },
      },
    ],
  },
  {
    name: "Investment LTV > 60%",
    when: 'occupancy == "investment" and ltv > 60',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Investment LTV > 60% | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 46, end: 46 },
      },
    ],
  },

  // ============================================================================
  // Loan Purpose 调整
  // ============================================================================
  {
    name: "Cash-Out",
    when: 'loanPurpose == "cashOut"',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Cash-Out | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 47, end: 47 },
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
        quote: "| 2-4 Unit | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 48, end: 48 },
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
        quote: "| Same line of work less than 2 year or extended employment gap*** | 0.125% to Rate or 0.50% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 49, end: 49 },
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
        lines: { start: 50, end: 50 },
      },
    ],
  },
  {
    name: "Condominium LTV > 65%",
    when: 'propertyType == "condo" and ltv > 65',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Condominium LTV > 65% | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 51, end: 51 },
      },
    ],
  },

  // ============================================================================
  // FICO 调整
  // ============================================================================
  {
    name: "FICO 680-699",
    when: "ficoScore >= 680 and ficoScore <= 699 and not isNoFico",
    rateAdj: 0.25,
    priceAdj: -0.125, // 0.125% to Fee = -0.125 price adjustment
    citations: [
      {
        quote: "| 680 to 699 FICO | 0.25% to Rate & 0.125% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 52, end: 52 },
      },
    ],
  },
  {
    name: "FICO 700-719",
    when: "ficoScore >= 700 and ficoScore <= 719 and not isNoFico",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| 700 to 719 FICO | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 53, end: 53 },
      },
    ],
  },

  // ============================================================================
  // Loan Amount 调整
  // ============================================================================
  {
    name: "Loan Amount $2.5MM-$3.5MM",
    when: "loanAmount > 2500000 and loanAmount <= 3500000",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Loan Amount $2,500,001 to $3,500,000 | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 54, end: 54 },
      },
    ],
  },
  {
    name: "Loan Amount > $3.5MM",
    when: "loanAmount > 3500000",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Loan Amount > $3,500,000 | 0.250% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 55, end: 55 },
      },
    ],
  },

  // ============================================================================
  // No FICO 调整
  // ============================================================================
  {
    name: "No FICO/No Credit History",
    when: "isNoFico",
    rateAdj: 0.5,
    citations: [
      {
        quote: "| No FICO/No Credit History | 0.50% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 56, end: 56 },
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
        lines: { start: 57, end: 57 },
      },
    ],
  },

  // ============================================================================
  // Documentation 调整
  // ============================================================================
  {
    name: "Borrower Signed P&L",
    when: "hasBorrowerSignedPL",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Borrower Signed P&L | 0.25% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 58, end: 58 },
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
export const RADIANT_PORTFOLIO_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 7, cost: 0.125, category: "all" },
  { days: 15, cost: 0.25, category: "all" },
];

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 */
export const RADIANT_PORTFOLIO_REQUIRED_FIELDS: Record<string, PricingFieldDef> = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score (680+, or N/A for No FICO)",
    example: 720,
  },
  ltv: {
    type: "number",
    description: "Loan-to-Value ratio (percentage, max 70%)",
    example: 65,
  },
  loanAmount: {
    type: "number",
    description: "Loan amount in dollars (max $4.5MM)",
    example: 1500000,
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
    values: ["sfr", "pud", "condo"],
    description: "Property type",
    example: "sfr",
  },
  units: {
    type: "number",
    description: "Number of units (1-4)",
    example: 1,
  },
  isNoFico: {
    type: "boolean",
    description: "Whether borrower has no FICO/No Credit History",
    example: false,
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
  hasBorrowerSignedPL: {
    type: "boolean",
    description: "Using borrower-signed P&L for income documentation",
    example: false,
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

/**
 * Radiant Portfolio 产品完整定价配置
 */
export const RADIANT_PORTFOLIO_PRICING_CONFIG = {
  productName: RADIANT_PORTFOLIO_RATE_SHEET.productName,
  baseRates: RADIANT_PORTFOLIO_BASE_RATES,
  adjustments: RADIANT_PORTFOLIO_ADJUSTMENTS,
  stackingRules: [],
  extensionCosts: RADIANT_PORTFOLIO_EXTENSION_COSTS,
  rateSheets: RADIANT_PORTFOLIO_RATE_SHEET.rateSheets,
} as const;
