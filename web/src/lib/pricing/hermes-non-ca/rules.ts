/**
 * Hermes Non-CA 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 runPricingSOP 工具使用
 *
 * 来源: GMCC Hermes Rate Sheet 9.15.25 - Non-CA.pdf
 *
 * Non-CA 版本特点：
 * - 贷款金额最高 $2.5MM（比 CA 低）
 * - 不支持 ADU
 * - $2-2.5MM 需要 FICO 700+（比 CA 的 680+ 更高）
 * - ABIO/Bank Statement 在 70.01-75% LTV 无调整
 */

import type { BaseRate, Adjustment, ExtensionCost, LLPAMatrix } from "../types";

// ============================================================================
// 元信息
// ============================================================================

export const HERMES_NON_CA_RATE_SHEET = {
  productName: "Hermes Non-CA",
  effectiveDate: "2025-09-15",
  margin: 3.0,
  index: "30-Day Avg. SOFR",
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/hermes/rate-sheets/GMCC Hermes Rate Sheet 9.15.25 - Non-CA.pdf",
      title: "GMCC Hermes Rate Sheet 9.15.25 - Non-CA",
    },
  ],
} as const;

// ============================================================================
// 基准利率
// ============================================================================

/**
 * 7/6 Month ARM (5/1/5 Caps) 基准利率
 */
export const HERMES_NON_CA_BASE_RATES_7_6_ARM: BaseRate[] = [
  { category: "7/6 ARM", rate: 6.125, price: 99.75 },
  { category: "7/6 ARM", rate: 6.25, price: 100 },
];

/**
 * 30 Year Fixed 基准利率
 *
 * 固定利率产品，利率比 ARM 高 0.25%
 */
export const HERMES_NON_CA_BASE_RATES_30YR_FIXED: BaseRate[] = [
  { category: "30 Year Fixed", rate: 6.375, price: 99.75 },
  { category: "30 Year Fixed", rate: 6.5, price: 100 },
];

/**
 * 所有基准利率
 */
export const HERMES_NON_CA_BASE_RATES: BaseRate[] = [
  ...HERMES_NON_CA_BASE_RATES_7_6_ARM,
  ...HERMES_NON_CA_BASE_RATES_30YR_FIXED,
];

// ============================================================================
// 定价调整项
// ============================================================================

const NON_CA_RATE_SHEET_DOC_PATH = "hermes/rate-sheets/GMCC Hermes Rate Sheet 9.15.25 - Non-CA.md";

// ============================================================================
// FICO/LTV LLPA 矩阵（按贷款金额分段）
// ============================================================================

/**
 * Hermes Non-CA FICO × LTV 定价矩阵
 *
 * 按贷款金额分 2 个矩阵，行 = FICO 区间，列 = LTV 区间
 * 引擎自动查表，替代逐条 Adjustment
 */
export const HERMES_NON_CA_LLPA_MATRICES: LLPAMatrix[] = [
  // ≤$2MM
  {
    name: "FICO/LTV (≤$2MM)",
    when: "loanAmount <= 2000000",
    ficoRanges: [
      { label: "700+", min: 700, max: Infinity },
      { label: "680-699", min: 680, max: 699 },
    ],
    ltvRanges: [
      { label: "≤60%", min: 0, max: 60 },
      { label: "60.01-65%", min: 60.01, max: 65 },
      { label: "65.01-70%", min: 65.01, max: 70 },
      { label: "70.01-75%", min: 70.01, max: 75 },
    ],
    values: [
      [0, 0, 0.25, 0.375],          // 700+
      [0.125, 0.125, 0.375, 0.375], // 680-699
    ],
    adjustmentType: "rate",
    citation: {
      quote: "| Loan Amount ≤ $2MM | 700+ | 0.000% | 0.000% | 0.250% | 0.375% |",
      docPath: NON_CA_RATE_SHEET_DOC_PATH,
      lines: { start: 30, end: 31 },
    },
  },
  // $2-2.5MM（Non-CA，需 FICO 700+）
  {
    name: "FICO/LTV ($2-2.5MM)",
    when: "loanAmount > 2000000 and loanAmount <= 2500000",
    ficoRanges: [
      { label: "700+", min: 700, max: Infinity },
    ],
    ltvRanges: [
      { label: "≤60%", min: 0, max: 60 },
      { label: "60.01-65%", min: 60.01, max: 65 },
      { label: "65.01-70%", min: 65.01, max: 70 },
      { label: "70.01-75%", min: 70.01, max: 75 },
    ],
    values: [
      [0.125, 0.25, 0.375, null], // 700+（70.01-75% 不可用）
    ],
    adjustmentType: "rate",
    citation: {
      quote: "| $2MM < Loan Amount ≤ $2.5MM | 700+ | 0.125% | 0.250% | 0.375% | |",
      docPath: NON_CA_RATE_SHEET_DOC_PATH,
      lines: { start: 32, end: 32 },
    },
  },
];

// ============================================================================
// 定价调整项（非矩阵部分）
// ============================================================================

/**
 * Hermes Non-CA 定价调整项
 *
 * FICO × LTV 矩阵已移至 HERMES_NON_CA_LLPA_MATRICES，此处仅保留单维度调整
 */
export const HERMES_NON_CA_ADJUSTMENTS: Adjustment[] = [
  // ============================================================================
  // Cash-Out 调整（根据 LTV）
  // ============================================================================
  {
    name: "Cash-Out LTV 60.01-65%",
    when: 'loanPurpose == "cashOut" and ltv > 60 and ltv <= 65',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Cash-Out | 0.000% | 0.250% | 0.375% | 0.500% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 39, end: 39 },
      },
    ],
  },
  {
    name: "Cash-Out LTV 65.01-70%",
    when: 'loanPurpose == "cashOut" and ltv > 65 and ltv <= 70',
    rateAdj: 0.375,
    citations: [
      {
        quote: "| Cash-Out | 0.000% | 0.250% | 0.375% | 0.500% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 39, end: 39 },
      },
    ],
  },
  {
    name: "Cash-Out LTV 70.01-75%",
    when: 'loanPurpose == "cashOut" and ltv > 70 and ltv <= 75',
    rateAdj: 0.5,
    citations: [
      {
        quote: "| Cash-Out | 0.000% | 0.250% | 0.375% | 0.500% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 39, end: 39 },
      },
    ],
  },

  // ============================================================================
  // Condominium 调整（根据 LTV，最高 70%）
  // ============================================================================
  {
    name: "Condo LTV 60.01-65%",
    when: 'propertyType == "condo" and ltv > 60 and ltv <= 65',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Condominium | 0.000% | 0.125% | 0.375% | |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 40, end: 40 },
      },
    ],
  },
  {
    name: "Condo LTV 65.01-70%",
    when: 'propertyType == "condo" and ltv > 65 and ltv <= 70',
    rateAdj: 0.375,
    citations: [
      {
        quote: "| Condominium | 0.000% | 0.125% | 0.375% | |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 40, end: 40 },
      },
    ],
  },

  // ============================================================================
  // 2-4 Unit 调整
  // ============================================================================
  {
    name: "2-4 Units LTV ≤70%",
    when: "units >= 2 and units <= 4 and ltv <= 70",
    rateAdj: 0.125,
    citations: [
      {
        quote: "| 2-4 Unit | 0.125% | 0.125% | 0.125% | 0.250% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 41, end: 41 },
      },
    ],
  },
  {
    name: "2-4 Units LTV 70.01-75%",
    when: "units >= 2 and units <= 4 and ltv > 70 and ltv <= 75",
    rateAdj: 0.25,
    citations: [
      {
        quote: "| 2-4 Unit | 0.125% | 0.125% | 0.125% | 0.250% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 41, end: 41 },
      },
    ],
  },

  // ============================================================================
  // Investment Property 调整
  // ============================================================================
  {
    name: "Investment LTV ≤60%",
    when: 'occupancy == "investment" and ltv <= 60',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Investment Property | 0.125% | 0.250% | 0.250% | 0.375% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 42, end: 42 },
      },
    ],
  },
  {
    name: "Investment LTV 60.01-65%",
    when: 'occupancy == "investment" and ltv > 60 and ltv <= 65',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Investment Property | 0.125% | 0.250% | 0.250% | 0.375% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 42, end: 42 },
      },
    ],
  },
  {
    name: "Investment LTV 65.01-70%",
    when: 'occupancy == "investment" and ltv > 65 and ltv <= 70',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| Investment Property | 0.125% | 0.250% | 0.250% | 0.375% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 42, end: 42 },
      },
    ],
  },
  {
    name: "Investment LTV 70.01-75%",
    when: 'occupancy == "investment" and ltv > 70 and ltv <= 75',
    rateAdj: 0.375,
    citations: [
      {
        quote: "| Investment Property | 0.125% | 0.250% | 0.250% | 0.375% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 42, end: 42 },
      },
    ],
  },

  // ============================================================================
  // Income Documentation 调整
  // ============================================================================
  {
    name: "Self-Prepared P&L",
    when: 'incomeDocType == "selfPreparedPL"',
    rateAdj: 0.5,
    citations: [
      {
        quote: "| Self-Prepared P&L Statement | 0.500% | 0.500% | 0.500% | 0.500% |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 43, end: 43 },
      },
    ],
  },
  // ABIO - 只到 LTV 70%（Non-CA 特有：70.01-75% 无调整）
  {
    name: "ABIO LTV ≤70%",
    when: 'incomeDocType == "abio" and ltv <= 70',
    rateAdj: 0.5,
    citations: [
      {
        quote: "| Asset Based Income Option (ABIO) | 0.500% | 0.500% | 0.500% | |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 44, end: 44 },
      },
    ],
  },
  // Bank Statement - 只到 LTV 70%（Non-CA 特有：70.01-75% 无调整）
  {
    name: "Bank Statement (3MB/BBS) LTV ≤70%",
    when: 'incomeDocType == "bankStatement" and ltv <= 70',
    rateAdj: 0.125,
    citations: [
      {
        quote: "| Banks Statement Options (3MB & BBS) | 0.125% | 0.125% | 0.125% | |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 45, end: 45 },
      },
    ],
  },

  // ============================================================================
  // Foreign National
  // ============================================================================
  {
    name: "Foreign National",
    when: "isForeignNational and ltv <= 60",
    rateAdj: 0.5,
    citations: [
      {
        quote: "| Foreign National | 0.500% | | | |",
        docPath: NON_CA_RATE_SHEET_DOC_PATH,
        lines: { start: 46, end: 46 },
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
export const HERMES_NON_CA_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 7, cost: 0.125, category: "7/6 ARM" },
  { days: 15, cost: 0.25, category: "7/6 ARM" },
];

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 */
export const HERMES_NON_CA_REQUIRED_FIELDS = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score",
    example: 720,
  },
  ltv: {
    type: "number",
    description: "Loan-to-Value ratio (percentage)",
    example: 70,
  },
  loanAmount: {
    type: "number",
    description: "Loan amount in dollars (max $2.5MM for Non-CA)",
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
    values: ["sfr", "pud", "condo", "multiUnit"],
    description: "Property type",
    example: "sfr",
  },
  units: {
    type: "number",
    description: "Number of units (1-4)",
    example: 1,
  },
  incomeDocType: {
    type: "enum",
    values: ["altDoc", "selfPreparedPL", "abio", "bankStatement"],
    description: "Income documentation type",
    example: "altDoc",
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
 * Hermes Non-CA 产品完整定价配置
 */
export const HERMES_NON_CA_PRICING_CONFIG = {
  productName: HERMES_NON_CA_RATE_SHEET.productName,
  baseRates: HERMES_NON_CA_BASE_RATES,
  adjustments: HERMES_NON_CA_ADJUSTMENTS,
  llpaMatrices: HERMES_NON_CA_LLPA_MATRICES,
  stackingRules: [],
  extensionCosts: HERMES_NON_CA_EXTENSION_COSTS,
  rateSheets: HERMES_NON_CA_RATE_SHEET.rateSheets,
} as const;
