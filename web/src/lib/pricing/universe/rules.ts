/**
 * Universe 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 runPricingSOP 工具使用
 *
 * 来源: GMCC Universe 12-22-2025 Snow.pdf
 */

import type { BaseRate, Adjustment, ExtensionCost } from "../types";

// ============================================================================
// 元信息
// ============================================================================

export const UNIVERSE_RATE_SHEET = {
  productName: "Universe",
  effectiveDate: "2025-12-22",
  codeName: "Snow",
  margin: 3.25,
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/universe/rate-sheets/GMCC Universe 12-22-2025 Snow.pdf",
      title: "GMCC Universe 12-22-2025 Snow",
    },
  ],
} as const;

// ============================================================================
// 基准利率
// ============================================================================

/**
 * 30 Year Fixed 基准利率
 *
 * 展示条件：state != "NY"（NY 使用专属 CRA 利率）
 */
export const UNIVERSE_BASE_RATES_30YR_FIXED: BaseRate[] = [
  { category: "30 Yr Fixed", rate: 5.875, price: 98.625, when: 'state != "NY"' },
  { category: "30 Yr Fixed", rate: 6.0, price: 98.875, when: 'state != "NY"' },
  { category: "30 Yr Fixed", rate: 6.125, price: 99.125, when: 'state != "NY"' },
  { category: "30 Yr Fixed", rate: 6.25, price: 99.375, when: 'state != "NY"' },
  { category: "30 Yr Fixed", rate: 6.375, price: 99.75, when: 'state != "NY"' },
];

/**
 * 10/1 ARM (2/2/6 Caps) 基准利率
 *
 * 展示条件：state != "NY"（NY 使用专属 CRA 利率）
 */
export const UNIVERSE_BASE_RATES_10_1_ARM: BaseRate[] = [
  { category: "10/1 ARM", rate: 5.75, price: 98.625, when: 'state != "NY"' },
  { category: "10/1 ARM", rate: 5.875, price: 98.875, when: 'state != "NY"' },
  { category: "10/1 ARM", rate: 6.0, price: 99.125, when: 'state != "NY"' },
  { category: "10/1 ARM", rate: 6.125, price: 99.375, when: 'state != "NY"' },
  { category: "10/1 ARM", rate: 6.25, price: 99.75, when: 'state != "NY"' },
];

/**
 * New York Properties 特殊利率（CRA Only）
 *
 * 展示条件：
 * - state == "NY"
 * - 只限 CRA 项目，覆盖 5 个县：Bronx, Kings, New York, Queens, Richmond
 */
export const UNIVERSE_BASE_RATES_NY: BaseRate[] = [
  { category: "NY Special", rate: 6.75, price: 99.75, when: 'state == "NY"' },
];

/**
 * 所有基准利率
 */
export const UNIVERSE_BASE_RATES: BaseRate[] = [
  ...UNIVERSE_BASE_RATES_10_1_ARM,
  ...UNIVERSE_BASE_RATES_30YR_FIXED,
  ...UNIVERSE_BASE_RATES_NY,
];

// ============================================================================
// 定价调整项
// ============================================================================

const RATE_SHEET_DOC_PATH = "universe/rate-sheets/GMCC Universe 12-22-2025 Snow.md";

/**
 * Universe 定价调整项
 *
 * 注意：以下调整为 0，已省略：
 * - NOO/2nd Home: 0
 * - 2-4 Units: 0
 * - Condo/PUD: 0
 * - LTV: 0
 * - Foreign National: 0
 */
export const UNIVERSE_ADJUSTMENTS: Adjustment[] = [
  // FICO 调整
  {
    name: "FICO 660-679",
    when: "ficoScore >= 660 and ficoScore <= 679",
    priceAdj: -0.25,
    citations: [
      {
        quote: "| FICO 660-679 | -0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 56, end: 56 },
      },
    ],
  },
  {
    name: "FICO 620-659",
    when: "ficoScore >= 620 and ficoScore <= 659",
    priceAdj: -0.5,
    citations: [
      {
        quote: "| FICO 620-659 | -0.50 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 57, end: 57 },
      },
    ],
  },
  {
    name: "FICO < 620",
    when: "ficoScore < 620",
    priceAdj: -1.0,
    citations: [
      {
        quote: "| FICO < 620 | -1.00 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 58, end: 58 },
      },
    ],
  },

  // 其他调整
  // 注意：filtrex 中布尔值需要用 == 1 或直接用变量名（truthy check）
  {
    name: "Refinance of Universe Loan",
    when: "isUniverseRefinance",
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Refinance of Universe loan** | -0.5 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 55, end: 55 },
      },
      {
        quote: "** This hit only applies if the previous loan for the subject property was also w/ GMCC – Universe. Management approval is required to refinance in these cases.",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 62, end: 62 },
      },
    ],
  },
  {
    name: "Doc Signing Outside U.S.",
    when: 'docSigningLocation == "outsideUS"',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Doc Signing Outside U.S. | -0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 59, end: 59 },
      },
    ],
  },
  {
    name: "Short Sale or Foreclosure within 5 Years",
    when: "hasShortSaleOrForeclosureWithin5Years",
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Short Sale or Foreclosure w/in Last 5 Yrs | -0.5 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 60, end: 60 },
      },
    ],
  },
];

// ============================================================================
// 延期费用
// ============================================================================

/**
 * 30 天延期费用
 */
export const UNIVERSE_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 30, cost: 0.75, category: "30 Yr Fixed" },
  { days: 30, cost: 0.375, category: "15 Yr Fixed" },
  { days: 30, cost: 0.5, category: "10/1 ARM" },
  { days: 30, cost: 0.25, category: "5/1 ARM" },
];

// ============================================================================
// 字段说明
// ============================================================================

/**
 * fieldValues 需要的字段及其说明
 *
 * 这些字段从用户对话中收集，传入 runPricingSOP 工具
 *
 * **注意**：filtrex 表达式语法
 * - 布尔值：直接用变量名作为 truthy check（如 `isUniverseRefinance`）
 * - 数值比较：`ficoScore >= 660 and ficoScore <= 679`
 * - 字符串比较：`docSigningLocation == "outsideUS"`
 */
export const UNIVERSE_REQUIRED_FIELDS = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score",
    example: 720,
  },
  state: {
    type: "enum",
    values: ["CA", "GA", "MA", "NV", "TX", "WA", "NY"],
    description: "Property state (NY uses special CRA rate)",
    example: "CA",
  },
  isUniverseRefinance: {
    type: "boolean",
    description: "Whether this is a refinance of an existing Universe loan",
    example: false,
  },
  docSigningLocation: {
    type: "enum",
    values: ["insideUS", "outsideUS"],
    description: "Where documents will be signed",
    example: "insideUS",
  },
  hasShortSaleOrForeclosureWithin5Years: {
    type: "boolean",
    description: "Whether borrower had short sale or foreclosure in last 5 years",
    example: false,
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

export const UNIVERSE_PRICING_CONFIG = {
  productName: UNIVERSE_RATE_SHEET.productName,
  baseRates: UNIVERSE_BASE_RATES,
  adjustments: UNIVERSE_ADJUSTMENTS,
  stackingRules: [],
  extensionCosts: UNIVERSE_EXTENSION_COSTS,
  rateSheets: UNIVERSE_RATE_SHEET.rateSheets,
} as const;
