/**
 * Radiant Assets Utilization (AU) 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 priceRadiantAu 工具使用
 *
 * 来源: GMCC Radiant Rate Sheet 1.2.2026.pdf (Page 1)
 *
 * AU 特点：
 * - 无收入/就业验证（No Income, No Employment）
 * - 无 DTI 计算
 * - CD 存款要求（12-24 个月 P&I）
 * - 支持 No FICO/No Credit History
 * - 调整是 RATE 调整（rateAdj）
 */

import type { BaseRate, Adjustment, ExtensionCost, PricingFieldDef } from "../types";

// ============================================================================
// 元信息
// ============================================================================

export const RADIANT_AU_RATE_SHEET = {
  productName: "Radiant AU",
  effectiveDate: "2026-01-02",
  margin: 3.0,
  index: "30 Day Average SOFR",
  minimumFinalRate: 6.0,
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/radiant/rate-sheets/GMCC Radiant Rate Sheet 1.2.2026.pdf",
      title: "GMCC Radiant Rate Sheet 1.2.2026 - Page 1",
    },
  ],
} as const;

// ============================================================================
// 基准利率
// ============================================================================

/**
 * 3/6 mo. ARM 2/1/5 基准利率
 */
export const RADIANT_AU_BASE_RATES_3_6_ARM: BaseRate[] = [
  { category: "3/6 ARM", rate: 6.25, price: 99.75 },
  { category: "3/6 ARM", rate: 6.125, price: 99.25 },
  { category: "3/6 ARM", rate: 6.0, price: 98.75 },
];

/**
 * 5/6 mo. ARM 2/1/5 基准利率
 */
export const RADIANT_AU_BASE_RATES_5_6_ARM: BaseRate[] = [
  { category: "5/6 ARM", rate: 6.375, price: 99.75 },
  { category: "5/6 ARM", rate: 6.25, price: 99.25 },
  { category: "5/6 ARM", rate: 6.125, price: 98.75 },
];

/**
 * 所有基准利率
 */
export const RADIANT_AU_BASE_RATES: BaseRate[] = [
  ...RADIANT_AU_BASE_RATES_3_6_ARM,
  ...RADIANT_AU_BASE_RATES_5_6_ARM,
];

// ============================================================================
// 定价调整项
// ============================================================================

const RATE_SHEET_DOC_PATH = "radiant/rate-sheets/assets-utilization.md";

/**
 * Radiant AU 定价调整项
 *
 * 重要：AU 的调整是 RATE 调整（rateAdj），不是 price 调整！
 */
export const RADIANT_AU_ADJUSTMENTS: Adjustment[] = [
  // ============================================================================
  // Occupancy 调整
  // ============================================================================
  {
    name: "Investment",
    when: 'occupancy == "investment"',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Investment | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 48, end: 48 },
      },
    ],
  },
  {
    name: "Investment LTV 55.01-60%",
    when: 'occupancy == "investment" and ltv > 55 and ltv <= 60',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Investment LTV 55.01% - 60% | 0.125% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 49, end: 49 },
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
        lines: { start: 50, end: 50 },
      },
    ],
  },

  // ============================================================================
  // LTV 调整
  // ============================================================================
  {
    name: "LTV 60.01-65%",
    when: "ltv > 60 and ltv <= 65",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| LTV 60.01% to 65% | 0.25% to Rate |",
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
    citations: [
      {
        quote: "| 680 to 699 FICO | 0.25% to Rate or 1.00% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 52, end: 52 },
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
        lines: { start: 53, end: 53 },
      },
    ],
  },

  // ============================================================================
  // No FICO 调整
  // ============================================================================
  {
    name: "No FICO LTV 50.01-60%",
    when: "isNoFico and ltv > 50 and ltv <= 60",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| LTV 50.01 to 60% (No FICO/No Credit History Only) | 0.25% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 54, end: 54 },
      },
    ],
  },
  {
    name: "No FICO/No Credit History",
    when: "isNoFico",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| No FICO/No Credit History | 0.25% to Rate or 1.00% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 55, end: 55 },
      },
    ],
  },

  // ============================================================================
  // 多房产调整
  // ============================================================================
  {
    name: "10+ Financed Properties",
    when: 'occupancy == "investment" and financedProperties > 10',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| More Than 10 Financed Properties (Investment Purpose Only) | 0.25% to Rate |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 56, end: 56 },
      },
    ],
  },

  // ============================================================================
  // Reserve/CD 调整
  // ============================================================================
  {
    name: "Reserve +6 Months",
    when: "reserveAdjustmentMonths > 0",
    rateAdj: -0.125, // 折扣
    citations: [
      {
        quote: "| 6 months reserve requirement (up or down)* | 0.125% to Rate or 0.500% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 62, end: 62 },
      },
    ],
  },
  {
    name: "Reserve -6 Months",
    when: "reserveAdjustmentMonths < 0",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| 6 months reserve requirement (up or down)* | 0.125% to Rate or 0.500% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 62, end: 62 },
      },
    ],
  },
  {
    name: "Waive CD (13 months)",
    when: "waiveCdMonths == 13 and not isNoFico",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Waive CD Requirement from 13 months (All Others)** | 0.25% to Rate or 1.00% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 70, end: 70 },
      },
    ],
  },
  {
    name: "CD Reduce to 13 months",
    when: 'waiveCdMonths == 13 and (isNoFico or loanPurpose == "cashOut")',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| CD Term Reduced to 13 months from 25 months (No FICO/No Credit and Cashout Only) | 0.25% to Rate or 1.00% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 71, end: 71 },
      },
    ],
  },
  {
    name: "Waive CD (25 months)",
    when: 'waiveCdMonths == 25 and (isNoFico or loanPurpose == "cashOut")',
    rateAdj: 0.5,
    citations: [
      {
        quote: "| Waive CD Requirement from 25 months** (No FICO/No Credit and Cashout Only) | 0.5% to Rate or 2.00% to Fee |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 72, end: 72 },
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
export const RADIANT_AU_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 7, cost: 0.125, category: "all" },
  { days: 15, cost: 0.25, category: "all" },
];

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 */
export const RADIANT_AU_REQUIRED_FIELDS: Record<string, PricingFieldDef> = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score (680+, or N/A for No FICO)",
    example: 720,
  },
  ltv: {
    type: "number",
    description: "Loan-to-Value ratio (percentage, max 65%)",
    example: 55,
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
    description: "Property type (no multi-unit for AU)",
    example: "sfr",
  },
  isNoFico: {
    type: "boolean",
    description: "Whether borrower has no FICO/No Credit History",
    example: false,
  },
  financedProperties: {
    type: "number",
    description: "Number of financed properties owned (for Investment only)",
    example: 0,
  },
  reserveAdjustmentMonths: {
    type: "number",
    description: "Reserve adjustment in months (positive = increase, negative = decrease)",
    example: 0,
  },
  waiveCdMonths: {
    type: "number",
    description: "CD waiver months (0 = no waiver, 13 or 25 = waive that term)",
    example: 0,
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

/**
 * Radiant AU 产品完整定价配置
 */
// 叠加规则（不使用 as const 以避免 readonly 类型问题）
const RADIANT_AU_STACKING_RULES = [
  { type: "mutex" as const, members: ["Reserve +6 Months", "Reserve -6 Months"] },
  { type: "mutex" as const, members: ["Waive CD (13 months)", "CD Reduce to 13 months", "Waive CD (25 months)"] },
];

export const RADIANT_AU_PRICING_CONFIG = {
  productName: RADIANT_AU_RATE_SHEET.productName,
  baseRates: RADIANT_AU_BASE_RATES,
  adjustments: RADIANT_AU_ADJUSTMENTS,
  stackingRules: RADIANT_AU_STACKING_RULES,
  extensionCosts: RADIANT_AU_EXTENSION_COSTS,
  rateSheets: RADIANT_AU_RATE_SHEET.rateSheets,
};
