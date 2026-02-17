/**
 * Celebrity 产品定价规则
 *
 * 从 Rate Sheet 预提取的定价规则，供 priceCelebrity 工具使用
 *
 * 来源: GMCC Celebrity Rate Sheet 1.28.2026.md
 *
 * Celebrity 产品线包含：
 * - Conforming Programs (30 Year Fixed)
 * - Government Programs (FHA, High Balance FHA)
 * - Community Opportunity Program
 * - Non-Conforming Programs (30 Year Fixed, 5/6 ARM, 7/6 ARM, 10/6 ARM)
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

export const CELEBRITY_RATE_SHEET = {
  productName: "Celebrity",
  effectiveDate: "2026-01-28",
  margin: 3.0, // ARM margin
  index: "SOFR",
  conformingLimit: 806500, // 2024 标准 Conforming 限额
  rateSheets: [
    {
      type: "pdf" as const,
      url: "/products/celebrity/rate-sheets/GMCC Celebrity Rate Sheet 1.28.2026.pdf",
      title: "GMCC Celebrity Rate Sheet 1.28.2026",
    },
  ],
} as const;

// ============================================================================
// 基准利率 - Conforming Programs（30-Day 价格）
// ============================================================================

/** 30 Year Conforming Fixed */
export const CELEBRITY_BASE_RATES_30_FIXED_CONFORMING: BaseRate[] = [
  { category: "30 Year Fixed Conforming", rate: 6.375, price: 102.449, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.45, price: 102.755, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.5, price: 102.96, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.575, price: 103.278, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.625, price: 103.491, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.7, price: 103.761, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.75, price: 103.941, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.825, price: 104.017, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.875, price: 104.067, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 6.95, price: 104.292, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.0, price: 104.441, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.075, price: 104.737, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.125, price: 104.934, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.2, price: 105.209, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.25, price: 105.393, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.3, price: 105.527, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.375, price: 105.729, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.425, price: 105.886, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.5, price: 106.123, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.55, price: 106.3, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.625, price: 106.567, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.675, price: 106.695, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.75, price: 106.887, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.8, price: 106.76, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.875, price: 106.57, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 7.925, price: 105.448, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 8.0, price: 106.015, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 8.05, price: 105.852, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Conforming", rate: 8.125, price: 106.27, when: 'loanType == "fixed"' },
];

// ============================================================================
// 基准利率 - Government Programs (FHA)（30-Day 价格）
// ============================================================================

/** 30 Year FHA */
export const CELEBRITY_BASE_RATES_30_FHA: BaseRate[] = [
  { category: "30 Year FHA", rate: 4.625, price: 96.249, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 4.7, price: 96.674, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 4.75, price: 96.957, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 4.825, price: 97.456, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 4.875, price: 97.789, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 4.95, price: 98.104, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.0, price: 98.314, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.075, price: 98.69, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.125, price: 98.94, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.2, price: 99.2, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.25, price: 99.374, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.325, price: 99.799, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.375, price: 100.082, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.45, price: 100.461, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.5, price: 100.714, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.575, price: 100.605, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.625, price: 100.532, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.7, price: 100.646, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.75, price: 100.796, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.825, price: 101.107, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.875, price: 101.352, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 5.925, price: 101.557, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.0, price: 101.864, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.05, price: 101.844, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.125, price: 101.814, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.175, price: 101.821, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.25, price: 102.059, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.3, price: 102.196, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.375, price: 102.432, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.425, price: 102.648, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.5, price: 102.972, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.55, price: 102.723, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.625, price: 102.477, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.675, price: 102.641, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.75, price: 102.908, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.8, price: 103.114, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.875, price: 103.422, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 6.925, price: 103.552, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 7.0, price: 103.748, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 7.05, price: 103.337, when: 'loanType == "fixed"' },
  { category: "30 Year FHA", rate: 7.125, price: 102.72, when: 'loanType == "fixed"' },
];

/** 30 Year High Balance FHA */
export const CELEBRITY_BASE_RATES_30_HB_FHA: BaseRate[] = [
  { category: "30 Year High Balance FHA", rate: 4.625, price: 95.972, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 4.7, price: 96.415, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 4.75, price: 96.71, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 4.825, price: 97.149, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 4.875, price: 97.442, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 4.95, price: 97.781, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.0, price: 98.007, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.075, price: 98.275, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.125, price: 98.454, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.2, price: 98.875, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.25, price: 99.155, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.325, price: 99.604, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.375, price: 99.904, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.45, price: 100.163, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.5, price: 100.335, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.575, price: 99.992, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.625, price: 99.948, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.7, price: 100.251, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.75, price: 100.46, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.825, price: 100.863, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.875, price: 101.131, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 5.925, price: 101.283, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.0, price: 101.512, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.05, price: 101.062, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.125, price: 100.572, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.175, price: 100.745, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.25, price: 101.059, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.3, price: 101.307, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.375, price: 101.679, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.425, price: 101.811, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.5, price: 102.008, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.55, price: 101.588, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.625, price: 100.956, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.675, price: 101.192, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.75, price: 101.545, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.8, price: 101.75, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.875, price: 102.058, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 6.925, price: 102.112, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 7.0, price: 102.194, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 7.05, price: 101.171, when: 'loanType == "fixed"' },
  { category: "30 Year High Balance FHA", rate: 7.125, price: 99.635, when: 'loanType == "fixed"' },
];

// ============================================================================
// 基准利率 - Community Opportunity Program（60-Day Lock Only）
// ============================================================================

/** 30 Year Community Opportunity Fixed */
export const CELEBRITY_BASE_RATES_30_COMMUNITY_OPP: BaseRate[] = [
  { category: "30 Year Community Opp Fixed", rate: 5.8, price: 101.5, when: 'loanType == "fixed"' },
  { category: "30 Year Community Opp Fixed", rate: 5.675, price: 101.0, when: 'loanType == "fixed"' },
  { category: "30 Year Community Opp Fixed", rate: 5.55, price: 100.5, when: 'loanType == "fixed"' },
];

// ============================================================================
// 基准利率 - Non-Conforming Programs（45-Day 价格作为基准）
// ============================================================================

/** 30 Year Non-Conforming Fixed */
export const CELEBRITY_BASE_RATES_30_FIXED_NON_CONFORMING: BaseRate[] = [
  { category: "30 Year Fixed Non-Conforming", rate: 5.375, price: 98.388, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 5.5, price: 98.817, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 5.625, price: 99.247, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 5.75, price: 99.661, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 5.875, price: 100.043, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 6.0, price: 100.402, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 6.125, price: 100.746, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 6.25, price: 101.074, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 6.375, price: 101.39, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 6.5, price: 101.679, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 6.625, price: 101.951, when: 'loanType == "fixed"' },
  { category: "30 Year Fixed Non-Conforming", rate: 6.75, price: 102.21, when: 'loanType == "fixed"' },
];

/** 5/6 SOFR ARM Non-Conforming (2/1/5 Caps, 3% Margin) */
export const CELEBRITY_BASE_RATES_5_6_ARM: BaseRate[] = [
  { category: "5/6 ARM Non-Conforming", rate: 5.575, price: 98.325, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 5.625, price: 98.61, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 5.7, price: 99.038, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 5.75, price: 99.323, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 5.825, price: 99.75, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 5.875, price: 99.925, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 5.95, price: 100.188, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.0, price: 100.35, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.05, price: 100.5, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.125, price: 100.725, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.175, price: 100.875, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.25, price: 101.088, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.3, price: 101.213, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.375, price: 101.375, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.425, price: 101.475, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.5, price: 101.588, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.55, price: 101.626, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.625, price: 101.683, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.675, price: 101.721, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.75, price: 101.778, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.8, price: 101.816, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.875, price: 101.873, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 6.925, price: 101.911, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 7.0, price: 101.968, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 7.05, price: 102.006, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 7.125, price: 102.063, when: 'loanType == "arm"' },
  { category: "5/6 ARM Non-Conforming", rate: 7.175, price: 102.101, when: 'loanType == "arm"' },
];

/** 7/6 SOFR ARM Non-Conforming (5/1/5 Caps, 3% Margin) */
export const CELEBRITY_BASE_RATES_7_6_ARM: BaseRate[] = [
  { category: "7/6 ARM Non-Conforming", rate: 5.825, price: 98.225, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 5.875, price: 98.51, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 5.95, price: 98.938, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.0, price: 99.223, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.075, price: 99.65, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.125, price: 99.825, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.2, price: 100.088, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.25, price: 100.25, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.3, price: 100.4, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.375, price: 100.625, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.425, price: 100.775, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.5, price: 100.988, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.55, price: 101.113, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.625, price: 101.275, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.675, price: 101.375, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.75, price: 101.488, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.8, price: 101.526, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.875, price: 101.583, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 6.925, price: 101.621, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.0, price: 101.678, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.05, price: 101.716, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.125, price: 101.773, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.175, price: 101.811, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.25, price: 101.868, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.3, price: 101.906, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.375, price: 101.963, when: 'loanType == "arm"' },
  { category: "7/6 ARM Non-Conforming", rate: 7.425, price: 102.001, when: 'loanType == "arm"' },
];

/** 10/6 SOFR ARM Non-Conforming (5/1/5 Caps, 3% Margin) */
export const CELEBRITY_BASE_RATES_10_6_ARM: BaseRate[] = [
  { category: "10/6 ARM Non-Conforming", rate: 6.075, price: 97.775, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.125, price: 98.06, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.2, price: 98.488, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.25, price: 98.773, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.325, price: 99.2, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.375, price: 99.375, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.45, price: 99.638, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.5, price: 99.8, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.55, price: 99.95, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.625, price: 100.175, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.675, price: 100.325, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.75, price: 100.538, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.8, price: 100.663, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.875, price: 100.825, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 6.925, price: 100.925, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.0, price: 101.038, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.05, price: 101.076, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.125, price: 101.133, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.175, price: 101.171, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.25, price: 101.228, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.3, price: 101.266, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.375, price: 101.323, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.425, price: 101.361, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.5, price: 101.418, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.55, price: 101.456, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.625, price: 101.513, when: 'loanType == "arm"' },
  { category: "10/6 ARM Non-Conforming", rate: 7.675, price: 101.551, when: 'loanType == "arm"' },
];

/** 所有基准利率 */
export const CELEBRITY_BASE_RATES: BaseRate[] = [
  // Conforming
  ...CELEBRITY_BASE_RATES_30_FIXED_CONFORMING,
  // FHA
  ...CELEBRITY_BASE_RATES_30_FHA,
  ...CELEBRITY_BASE_RATES_30_HB_FHA,
  // Community Opportunity
  ...CELEBRITY_BASE_RATES_30_COMMUNITY_OPP,
  // Non-Conforming
  ...CELEBRITY_BASE_RATES_30_FIXED_NON_CONFORMING,
  ...CELEBRITY_BASE_RATES_5_6_ARM,
  ...CELEBRITY_BASE_RATES_7_6_ARM,
  ...CELEBRITY_BASE_RATES_10_6_ARM,
];

// ============================================================================
// LLPA 矩阵数据
// ============================================================================

const RATE_SHEET_DOC_PATH =
  "celebrity/rate-sheets/GMCC Celebrity Rate Sheet 1.28.2026.md";

// Conforming FICO 范围（9 行，含 <640）
const CONFORMING_FICO_RANGES: readonly LLPARange[] = [
  { label: ">=780", min: 780, max: Infinity },
  { label: "760-779", min: 760, max: 779 },
  { label: "740-759", min: 740, max: 759 },
  { label: "720-739", min: 720, max: 739 },
  { label: "700-719", min: 700, max: 719 },
  { label: "680-699", min: 680, max: 699 },
  { label: "660-679", min: 660, max: 679 },
  { label: "640-659", min: 640, max: 659 },
  { label: "<640", min: 0, max: 639 },
];

// Conforming LTV 范围（Purchase/Refinance，8 列）
const CONFORMING_LTV_RANGES: readonly LLPARange[] = [
  { label: "30.01-60", min: 30.01, max: 60 },
  { label: "60.01-70", min: 60.01, max: 70 },
  { label: "70.01-75", min: 70.01, max: 75 },
  { label: "75.01-80", min: 75.01, max: 80 },
  { label: "80.01-85", min: 80.01, max: 85 },
  { label: "85.01-90", min: 85.01, max: 90 },
  { label: "90.01-95", min: 90.01, max: 95 },
  { label: "95.01-97", min: 95.01, max: 97 },
];

// Cash-Out LTV 范围（只到 80%）
const CASHOUT_LTV_RANGES: readonly LLPARange[] = [
  { label: "<=30", min: 0, max: 30 },
  { label: "30.01-60", min: 30.01, max: 60 },
  { label: "60.01-70", min: 60.01, max: 70 },
  { label: "70.01-75", min: 70.01, max: 75 },
  { label: "75.01-80", min: 75.01, max: 80 },
];

// Non-Conforming FICO 范围（7 行）
const NON_CONFORMING_FICO_RANGES: readonly LLPARange[] = [
  { label: ">=780", min: 780, max: Infinity },
  { label: "760-779", min: 760, max: 779 },
  { label: "740-759", min: 740, max: 759 },
  { label: "720-739", min: 720, max: 739 },
  { label: "700-719", min: 700, max: 719 },
  { label: "680-699", min: 680, max: 699 },
  { label: "660-679", min: 660, max: 679 },
];

// Non-Conforming LTV 范围（9 列）
const NON_CONFORMING_LTV_RANGES: readonly LLPARange[] = [
  { label: "<=50", min: 0, max: 50 },
  { label: "50.01-55", min: 50.01, max: 55 },
  { label: "55.01-60", min: 55.01, max: 60 },
  { label: "60.01-65", min: 60.01, max: 65 },
  { label: "65.01-70", min: 65.01, max: 70 },
  { label: "70.01-75", min: 70.01, max: 75 },
  { label: "75.01-80", min: 75.01, max: 80 },
  { label: "80.01-85", min: 80.01, max: 85 },
  { label: "85.01-90", min: 85.01, max: 90 },
];

// Community Opportunity FICO 范围（7 行）
const COMMUNITY_OPP_FICO_RANGES: readonly LLPARange[] = [
  { label: ">=760", min: 760, max: Infinity },
  { label: "740-759", min: 740, max: 759 },
  { label: "720-739", min: 720, max: 739 },
  { label: "700-719", min: 700, max: 719 },
  { label: "680-699", min: 680, max: 699 },
  { label: "660-679", min: 660, max: 679 },
  { label: "640-659", min: 640, max: 659 },
];

// Community Opportunity LTV 范围（5 列）
const COMMUNITY_OPP_LTV_RANGES: readonly LLPARange[] = [
  { label: "<=85", min: 0, max: 85 },
  { label: "85.01-90", min: 85.01, max: 90 },
  { label: "90.01-95", min: 90.01, max: 95 },
  { label: "95.01-97", min: 95.01, max: 97 },
  { label: "97.01-100", min: 97.01, max: 100 },
];

/** Conforming Purchase LLPA 矩阵（仅 Fixed，ARM 不适用） */
const CONFORMING_PURCHASE_LLPA: LLPAMatrix = {
  name: "Conforming Purchase LLPA",
  when: 'loanProgram == "conforming" and loanPurpose == "purchase" and loanType == "fixed"',
  ficoRanges: CONFORMING_FICO_RANGES,
  ltvRanges: CONFORMING_LTV_RANGES,
  // 行：FICO（从高到低），列：LTV（从低到高）
  // 值来自 Rate Sheet 312-322 行
  values: [
    // 30-60  60-70  70-75  75-80  80-85  85-90  90-95  95-97
    [0, 0, 0, 0.375, 0.375, 0.25, 0.25, 0.125], // >=780
    [0, 0, 0.25, 0.625, 0.625, 0.5, 0.5, 0.25], // 760-779
    [0, 0.125, 0.375, 0.875, 1.0, 0.75, 0.625, 0.5], // 740-759
    [0, 0.25, 0.75, 1.25, 1.25, 1.0, 0.875, 0.75], // 720-739
    [0, 0.375, 0.875, 1.375, 1.5, 1.25, 1.125, 0.875], // 700-719
    [0, 0.625, 1.125, 1.75, 1.875, 1.5, 1.375, 1.125], // 680-699
    [0, 0.75, 1.375, 1.875, 2.125, 1.75, 1.625, 1.25], // 660-679
    [0, 1.125, 1.5, 2.25, 2.5, 2.0, 1.875, 1.5], // 640-659
    [0.125, 1.5, 2.125, 2.75, 2.875, 2.625, 2.25, 1.75], // <640
  ],
  adjustmentType: "price",
  citation: {
    quote: "#### FICO/LTV - 30 Year Conforming (Purchase)",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 310, end: 322 },
  },
};

/** Conforming Limited Cash Out Refinance LLPA 矩阵（仅 Fixed，ARM 不适用） */
const CONFORMING_REFINANCE_LLPA: LLPAMatrix = {
  name: "Conforming Limited Cash Out Refinance LLPA",
  when: 'loanProgram == "conforming" and loanPurpose == "refinance" and loanType == "fixed"',
  ficoRanges: CONFORMING_FICO_RANGES,
  ltvRanges: CONFORMING_LTV_RANGES,
  // 值来自 Rate Sheet 326-336 行
  values: [
    // 30-60  60-70  70-75  75-80  80-85  85-90  90-97  95-97
    [0, 0, 0.125, 0.5, 0.625, 0.5, 0.375, 0.375], // >=780
    [0, 0.125, 0.375, 0.875, 1.0, 0.75, 0.625, 0.625], // 760-779
    [0, 0.25, 0.75, 1.125, 1.375, 1.125, 1.0, 1.0], // 740-759
    [0, 0.5, 1.0, 1.625, 1.75, 1.5, 1.25, 1.25], // 720-739
    [0, 0.625, 1.25, 1.875, 2.125, 1.75, 1.625, 1.625], // 700-719
    [0, 0.875, 1.625, 2.25, 2.5, 2.125, 1.75, 1.75], // 680-699
    [0.125, 1.125, 1.875, 2.5, 3.0, 2.375, 2.125, 2.125], // 660-679
    [0.25, 1.375, 2.125, 2.875, 3.375, 2.875, 2.5, 2.5], // 640-659
    [0.375, 1.75, 2.5, 3.5, 3.875, 3.625, 2.5, 2.5], // <640
  ],
  adjustmentType: "price",
  citation: {
    quote: "#### FICO/LTV - 30 Year Conforming (Limited Cash Out Refinance)",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 324, end: 336 },
  },
};

/** Conforming Cash-Out LLPA 矩阵（仅 Fixed，ARM 不适用） */
const CONFORMING_CASHOUT_LLPA: LLPAMatrix = {
  name: "Conforming Cash-Out Refinance LLPA",
  when: 'loanProgram == "conforming" and loanPurpose == "cashOut" and loanType == "fixed"',
  ficoRanges: CONFORMING_FICO_RANGES,
  ltvRanges: CASHOUT_LTV_RANGES,
  // 值来自 Rate Sheet 355-365 行
  values: [
    // <=30   30-60  60-70  70-75  75-80
    [0.375, 0.375, 0.625, 0.875, 1.375], // >=780
    [0.375, 0.375, 0.875, 1.25, 1.875], // 760-779
    [0.375, 0.375, 1.0, 1.625, 2.375], // 740-759
    [0.375, 0.5, 1.375, 2.0, 2.75], // 720-739
    [0.375, 0.5, 1.625, 2.625, 3.25], // 700-719
    [0.375, 0.625, 2.0, 2.875, 3.75], // 680-699
    [0.375, 0.875, 2.75, 4.0, 4.75], // 660-679
    [0.375, 1.375, 3.125, 4.625, 5.125], // 640-659
    [0.375, 1.375, 3.375, 4.875, 5.125], // <640
  ],
  adjustmentType: "price",
  citation: {
    quote: "#### FICO/LTV - 30 Year Conforming (Cash Out Refinance)",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 353, end: 365 },
  },
};

/** Non-Conforming Purchase LLPA 矩阵（仅 Fixed，ARM 不适用） */
const NON_CONFORMING_PURCHASE_LLPA: LLPAMatrix = {
  name: "Non-Conforming Purchase LLPA",
  when: 'loanProgram == "nonConforming" and loanPurpose == "purchase" and loanType == "fixed"',
  ficoRanges: NON_CONFORMING_FICO_RANGES,
  ltvRanges: NON_CONFORMING_LTV_RANGES,
  // 值来自 Rate Sheet 417-425 行
  // 注意：正值表示加分（rebate），负值表示收费
  values: [
    // <=50   50-55  55-60  60-65  65-70  70-75  75-80  80-85  85-90
    [-1.25, -0.875, -0.625, -0.375, -0.25, -0.25, -0.25, 1.375, 1.75], // >=780
    [-1.125, -0.75, -0.5, -0.25, -0.125, -0.125, -0.125, 2.375, 2.75], // 760-779
    [-0.875, -0.625, -0.5, -0.25, -0.125, -0.125, 0, 3.375, 3.75], // 740-759
    [-0.75, -0.5, -0.375, -0.25, 0, 0, 0.25, 4.125, 4.5], // 720-739
    [-0.625, -0.375, -0.25, 0, 0, 0.625, 1.0, 4.875, 5.25], // 700-719
    [-0.5, -0.25, 0, 0.125, 0.625, 1.0, 1.75, 5.625, 6.0], // 680-699
    [-0.375, -0.125, 0, 0.25, 1.0, 2.0, 3.0, null, null], // 660-679
  ],
  adjustmentType: "price",
  citation: {
    quote: "#### Purchase - FICO/LTV",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 415, end: 425 },
  },
};

/** Non-Conforming Limited Cash Out Refinance LLPA 矩阵（仅 Fixed，ARM 不适用） */
const NON_CONFORMING_REFINANCE_LLPA: LLPAMatrix = {
  name: "Non-Conforming Limited Cash Out Refinance LLPA",
  when: 'loanProgram == "nonConforming" and loanPurpose == "refinance" and loanType == "fixed"',
  ficoRanges: NON_CONFORMING_FICO_RANGES,
  ltvRanges: NON_CONFORMING_LTV_RANGES,
  // 值来自 Rate Sheet 429-437 行
  values: [
    // <=50   50-55  55-60  60-65  65-70  70-75  75-80  80-85  85-90
    [-1.125, -0.75, -0.5, -0.25, -0.125, -0.125, -0.125, 1.5, 1.875], // >=780
    [-1.0, -0.625, -0.375, -0.125, 0, 0, 0, 2.5, 2.875], // 760-779
    [-0.75, -0.5, -0.375, -0.125, 0, 0, 0.125, 3.5, 3.875], // 740-759
    [-0.625, -0.375, -0.25, -0.125, 0.125, 0.125, 0.375, 4.25, 4.625], // 720-739
    [-0.5, -0.25, -0.125, 0.125, 0.125, 0.75, 1.125, 5.0, 5.375], // 700-719
    [-0.375, -0.125, 0.125, 0.25, 0.75, 1.125, 1.875, 5.75, 6.125], // 680-699
    [-0.25, 0, 0.125, 0.375, 1.125, 2.125, 3.125, null, null], // 660-679
  ],
  adjustmentType: "price",
  citation: {
    quote: "#### Limited Cash Out Refinance - FICO/LTV",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 427, end: 437 },
  },
};

/** Community Opportunity LLPA 矩阵 */
const COMMUNITY_OPP_LLPA: LLPAMatrix = {
  name: "Community Opportunity FICO/LTV",
  when: 'loanProgram == "communityOpp"',
  ficoRanges: COMMUNITY_OPP_FICO_RANGES,
  ltvRanges: COMMUNITY_OPP_LTV_RANGES,
  // 值来自 Rate Sheet 397-405 行
  // 注意：这些是 rate 调整（百分比形式）
  values: [
    // <=85   85-90  90-95  95-97  97-100
    [0.181, 0.266, 0.323, 0.437, 0.621], // >=760
    [0.19, 0.361, 0.456, 0.551, 0.783], // 740-759
    [0.219, 0.437, 0.561, 0.665, 0.945], // 720-739
    [0.238, 0.523, 0.646, 0.751, 1.067], // 700-719
    [0.266, 0.618, 0.827, 0.931, 1.323], // 680-699
    [0.361, 0.855, 1.055, 1.169, 1.661], // 660-679
    [0.38, 0.865, 1.131, 1.245, null], // 640-659
  ],
  adjustmentType: "rate",
  citation: {
    quote: "### Community Opportunity - FICO/LTV",
    docPath: RATE_SHEET_DOC_PATH,
    lines: { start: 395, end: 405 },
  },
};

/** 所有 LLPA 矩阵 */
export const CELEBRITY_LLPA_MATRICES: readonly LLPAMatrix[] = [
  CONFORMING_PURCHASE_LLPA,
  CONFORMING_REFINANCE_LLPA,
  CONFORMING_CASHOUT_LLPA,
  NON_CONFORMING_PURCHASE_LLPA,
  NON_CONFORMING_REFINANCE_LLPA,
  COMMUNITY_OPP_LLPA,
];

// ============================================================================
// 非矩阵调整项
// ============================================================================

/**
 * Celebrity 定价调整项（非矩阵规则）
 *
 * 这些规则无法用 FICO × LTV 矩阵表示，保留传统格式
 */
export const CELEBRITY_ADJUSTMENTS: Adjustment[] = [
  // ============================================================================
  // Conforming Feature Adjustments (Purchase & Limited Cash Out Refinance)
  // ============================================================================

  // Condo
  {
    name: "Condo LTV 60.01-75% (Conforming)",
    when: 'loanProgram == "conforming" and propertyType == "condo" and ltv > 60 and ltv <= 75 and loanPurpose != "cashOut"',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| Condo | 0.000 | 0.000 | -0.125 | -0.125 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 301, end: 301 },
      },
    ],
  },
  {
    name: "Condo LTV > 75% (Conforming)",
    when: 'loanProgram == "conforming" and propertyType == "condo" and ltv > 75 and loanPurpose != "cashOut"',
    priceAdj: -0.75,
    citations: [
      {
        quote: "| Condo | ... | -0.750 | -0.750 | -0.750 | -0.750 | -0.750 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 301, end: 301 },
      },
    ],
  },

  // Investment Property (Conforming)
  {
    name: "Investment Property LTV <=60% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "investment" and ltv <= 60 and loanPurpose != "cashOut"',
    priceAdj: -1.125,
    citations: [
      {
        quote: "| Investment Property | -1.125 | -1.125 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 302, end: 302 },
      },
    ],
  },
  {
    name: "Investment Property LTV 60.01-70% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "investment" and ltv > 60 and ltv <= 70 and loanPurpose != "cashOut"',
    priceAdj: -1.625,
    citations: [
      {
        quote: "| Investment Property | ... | -1.625 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 302, end: 302 },
      },
    ],
  },
  {
    name: "Investment Property LTV 70.01-75% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "investment" and ltv > 70 and ltv <= 75 and loanPurpose != "cashOut"',
    priceAdj: -2.125,
    citations: [
      {
        quote: "| Investment Property | ... | -2.125 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 302, end: 302 },
      },
    ],
  },
  {
    name: "Investment Property LTV 75.01-80% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "investment" and ltv > 75 and ltv <= 80 and loanPurpose != "cashOut"',
    priceAdj: -3.375,
    citations: [
      {
        quote: "| Investment Property | ... | -3.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 302, end: 302 },
      },
    ],
  },
  {
    name: "Investment Property LTV > 80% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "investment" and ltv > 80 and loanPurpose != "cashOut"',
    priceAdj: -4.125,
    citations: [
      {
        quote: "| Investment Property | ... | -4.125 | N/A | N/A | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 302, end: 302 },
      },
    ],
  },

  // Second Home (Conforming)
  {
    name: "Second Home LTV <=60% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "secondHome" and ltv <= 60 and loanPurpose != "cashOut"',
    priceAdj: -1.125,
    citations: [
      {
        quote: "| Second Home | -1.125 | -1.125 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 303, end: 303 },
      },
    ],
  },
  {
    name: "Second Home LTV 60.01-70% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "secondHome" and ltv > 60 and ltv <= 70 and loanPurpose != "cashOut"',
    priceAdj: -1.625,
    citations: [
      {
        quote: "| Second Home | ... | -1.625 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 303, end: 303 },
      },
    ],
  },
  {
    name: "Second Home LTV 70.01-75% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "secondHome" and ltv > 70 and ltv <= 75 and loanPurpose != "cashOut"',
    priceAdj: -2.125,
    citations: [
      {
        quote: "| Second Home | ... | -2.125 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 303, end: 303 },
      },
    ],
  },
  {
    name: "Second Home LTV 75.01-80% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "secondHome" and ltv > 75 and ltv <= 80 and loanPurpose != "cashOut"',
    priceAdj: -3.375,
    citations: [
      {
        quote: "| Second Home | ... | -3.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 303, end: 303 },
      },
    ],
  },
  {
    name: "Second Home LTV > 80% (Conforming)",
    when: 'loanProgram == "conforming" and occupancy == "secondHome" and ltv > 80 and loanPurpose != "cashOut"',
    priceAdj: -4.125,
    citations: [
      {
        quote: "| Second Home | ... | -4.125 | -4.125 | N/A | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 303, end: 303 },
      },
    ],
  },

  // Manufactured Home (Conforming)
  {
    name: "Manufactured Home (Conforming)",
    when: 'loanProgram == "conforming" and propertyType == "manufactured"',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Manufactured Home | -0.500 | ... (all LTV) |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 304, end: 304 },
      },
    ],
  },

  // Two Unit Property (Conforming)
  {
    name: "Two Unit Property LTV 60.01-95% (Conforming)",
    when: 'loanProgram == "conforming" and units == 2 and ltv > 60 and ltv <= 75 and loanPurpose != "cashOut"',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| Two Unit Property | 0.000 | 0.000 | -0.375 | -0.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 305, end: 305 },
      },
    ],
  },
  {
    name: "Two Unit Property LTV > 75% (Conforming)",
    when: 'loanProgram == "conforming" and units == 2 and ltv > 75 and loanPurpose != "cashOut"',
    priceAdj: -0.625,
    citations: [
      {
        quote: "| Two Unit Property | ... | -0.625 | -0.625 | -0.625 | -0.625 | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 305, end: 305 },
      },
    ],
  },

  // Three to Four Unit Property (Conforming)
  {
    name: "3-4 Unit Property LTV 60.01-75% (Conforming)",
    when: 'loanProgram == "conforming" and units >= 3 and units <= 4 and ltv > 60 and ltv <= 75 and loanPurpose != "cashOut"',
    priceAdj: -0.375,
    citations: [
      {
        quote:
          "| Three to Four Unit Property | 0.000 | 0.000 | -0.375 | -0.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 306, end: 306 },
      },
    ],
  },
  {
    name: "3-4 Unit Property LTV > 75% (Conforming)",
    when: 'loanProgram == "conforming" and units >= 3 and units <= 4 and ltv > 75 and loanPurpose != "cashOut"',
    priceAdj: -0.625,
    citations: [
      {
        quote:
          "| Three to Four Unit Property | ... | -0.625 | -0.625 | -0.625 | -0.625 | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 306, end: 306 },
      },
    ],
  },

  // Subordinate Financing (Conforming)
  {
    name: "Subordinate Financing LTV <=70% (Conforming)",
    when: 'loanProgram == "conforming" and hasSubordinateFinancing and ltv <= 70 and loanPurpose != "cashOut"',
    priceAdj: -0.625,
    citations: [
      {
        quote: "| Sub Financing (External) | -0.625 | -0.625 | -0.625 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 307, end: 307 },
      },
    ],
  },
  {
    name: "Subordinate Financing LTV 70.01-75% (Conforming)",
    when: 'loanProgram == "conforming" and hasSubordinateFinancing and ltv > 70 and ltv <= 75 and loanPurpose != "cashOut"',
    priceAdj: -0.875,
    citations: [
      {
        quote: "| Sub Financing (External) | ... | -0.875 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 307, end: 307 },
      },
    ],
  },
  {
    name: "Subordinate Financing LTV 75.01-90% (Conforming)",
    when: 'loanProgram == "conforming" and hasSubordinateFinancing and ltv > 75 and ltv <= 90 and loanPurpose != "cashOut"',
    priceAdj: -1.125,
    citations: [
      {
        quote: "| Sub Financing (External) | ... | -1.125 | -1.125 | -1.125 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 307, end: 307 },
      },
    ],
  },
  {
    name: "Subordinate Financing LTV > 90% (Conforming)",
    when: 'loanProgram == "conforming" and hasSubordinateFinancing and ltv > 90 and loanPurpose != "cashOut"',
    priceAdj: -1.875,
    citations: [
      {
        quote: "| Sub Financing (External) | ... | -1.875 | -1.875 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 307, end: 307 },
      },
    ],
  },

  // Escrow Waiver (Conforming)
  {
    name: "Escrow Waiver (Conforming)",
    when: 'loanProgram == "conforming" and escrowWaiver',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Escrow Waiver | -0.250 | ... (all LTV) |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 308, end: 308 },
      },
    ],
  },

  // ============================================================================
  // FHA Adjustments
  // ============================================================================

  // FHA FICO/Loan Amount Adjustments
  {
    name: "FHA FICO 700-719, Loan Amount <=110K",
    when: 'loanProgram == "fha" and ficoScore >= 700 and ficoScore <= 719 and loanAmount <= 110000',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| 700-719 | -0.375 | 0.000 | 0.000 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 371, end: 371 },
      },
    ],
  },
  {
    name: "FHA FICO 680-699, Loan Amount <=110K",
    when: 'loanProgram == "fha" and ficoScore >= 680 and ficoScore <= 699 and loanAmount <= 110000',
    priceAdj: -0.625,
    citations: [
      {
        quote: "| 680-699 | -0.625 | -0.125 | 0.000 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 372, end: 372 },
      },
    ],
  },
  {
    name: "FHA FICO 680-699, Loan Amount 110K-225K",
    when: 'loanProgram == "fha" and ficoScore >= 680 and ficoScore <= 699 and loanAmount > 110000 and loanAmount <= 225000',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| 680-699 | -0.625 | -0.125 | 0.000 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 372, end: 372 },
      },
    ],
  },
  {
    name: "FHA FICO 660-679, Loan Amount <=110K",
    when: 'loanProgram == "fha" and ficoScore >= 660 and ficoScore <= 679 and loanAmount <= 110000',
    priceAdj: -1.125,
    citations: [
      {
        quote: "| 660-679 | -1.125 | -0.875 | -0.625 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 373, end: 373 },
      },
    ],
  },
  {
    name: "FHA FICO 660-679, Loan Amount 110K-225K",
    when: 'loanProgram == "fha" and ficoScore >= 660 and ficoScore <= 679 and loanAmount > 110000 and loanAmount <= 225000',
    priceAdj: -0.875,
    citations: [
      {
        quote: "| 660-679 | -1.125 | -0.875 | -0.625 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 373, end: 373 },
      },
    ],
  },
  {
    name: "FHA FICO 660-679, Loan Amount >225K",
    when: 'loanProgram == "fha" and ficoScore >= 660 and ficoScore <= 679 and loanAmount > 225000',
    priceAdj: -0.625,
    citations: [
      {
        quote: "| 660-679 | -1.125 | -0.875 | -0.625 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 373, end: 373 },
      },
    ],
  },
  {
    name: "FHA FICO 640-659, Loan Amount <=110K",
    when: 'loanProgram == "fha" and ficoScore >= 640 and ficoScore <= 659 and loanAmount <= 110000',
    priceAdj: -2.125,
    citations: [
      {
        quote: "| 640-659 | -2.125 | -2.000 | -1.750 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 374, end: 374 },
      },
    ],
  },
  {
    name: "FHA FICO 640-659, Loan Amount 110K-225K",
    when: 'loanProgram == "fha" and ficoScore >= 640 and ficoScore <= 659 and loanAmount > 110000 and loanAmount <= 225000',
    priceAdj: -2.0,
    citations: [
      {
        quote: "| 640-659 | -2.125 | -2.000 | -1.750 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 374, end: 374 },
      },
    ],
  },
  {
    name: "FHA FICO 640-659, Loan Amount >225K",
    when: 'loanProgram == "fha" and ficoScore >= 640 and ficoScore <= 659 and loanAmount > 225000',
    priceAdj: -1.75,
    citations: [
      {
        quote: "| 640-659 | -2.125 | -2.000 | -1.750 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 374, end: 374 },
      },
    ],
  },
  {
    name: "FHA FICO 620-639 (All Loan Amounts)",
    when: 'loanProgram == "fha" and ficoScore >= 620 and ficoScore <= 639',
    priceAdj: -5.0,
    citations: [
      {
        quote: "| 620-639 | -5.000 | -5.000 | -5.000 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 375, end: 375 },
      },
    ],
  },

  // FHA Feature Adjustments
  {
    name: "Investment Property (FHA)",
    when: 'loanProgram == "fha" and occupancy == "investment"',
    priceAdj: -1.5,
    citations: [
      {
        quote: "| Investment Property | -1.500 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 381, end: 381 },
      },
    ],
  },
  {
    name: "Second Home (FHA)",
    when: 'loanProgram == "fha" and occupancy == "secondHome"',
    priceAdj: -0.75,
    citations: [
      {
        quote: "| Second Home | -0.750 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 382, end: 382 },
      },
    ],
  },
  {
    name: "Escrow Waiver (FHA)",
    when: 'loanProgram == "fha" and escrowWaiver',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Escrow Waiver | -0.250 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 383, end: 383 },
      },
    ],
  },

  // ============================================================================
  // Community Opportunity Feature Adjustments
  // ============================================================================

  {
    name: "High Balance (Community Opp)",
    when: 'loanProgram == "communityOpp" and isHighBalance',
    priceAdj: -0.5, // 0.500% fee
    citations: [
      {
        quote: "| High Balance | 0.500% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 389, end: 389 },
      },
    ],
  },
  {
    name: "Condo (Community Opp)",
    when: 'loanProgram == "communityOpp" and propertyType == "condo"',
    priceAdj: -0.25, // 0.250% fee
    citations: [
      {
        quote: "| Condo | 0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 390, end: 390 },
      },
    ],
  },
  {
    name: "LMIB (Community Opp)",
    when: 'loanProgram == "communityOpp" and isLMIB',
    priceAdj: 0.125, // -0.125% (discount)
    citations: [
      {
        quote: "| Low-To-Moderate Income Borrowers (LMIB) | -0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 391, end: 391 },
      },
    ],
  },
  {
    name: "LMIT (Community Opp)",
    when: 'loanProgram == "communityOpp" and isLMIT',
    priceAdj: 0.125, // -0.125% (discount)
    citations: [
      {
        quote: "| Low-To-Moderate Income Census Tract (LMIT) | -0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 392, end: 392 },
      },
    ],
  },
  {
    name: "MMCT (Community Opp)",
    when: 'loanProgram == "communityOpp" and isMMCT',
    priceAdj: 0.125, // -0.125% (discount)
    citations: [
      {
        quote: "| Majority-Minority Census Tract (MMCT) | -0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 393, end: 393 },
      },
    ],
  },

  // ============================================================================
  // Non-Conforming Feature Adjustments
  // ============================================================================

  // 2 Unit (Non-Conforming)
  {
    name: "2 Unit LTV <=60% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and units == 2 and ltv <= 60',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| 2 Unit | -0.250 | -0.250 | -0.250 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 454, end: 454 },
      },
    ],
  },
  {
    name: "2 Unit LTV 60.01-65% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and units == 2 and ltv > 60 and ltv <= 65',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| 2 Unit | ... | -0.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 454, end: 454 },
      },
    ],
  },
  {
    name: "2 Unit LTV 65.01-70% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and units == 2 and ltv > 65 and ltv <= 70',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| 2 Unit | ... | -0.500 | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 454, end: 454 },
      },
    ],
  },

  // 3-4 Units (Non-Conforming)
  {
    name: "3-4 Units LTV <=60% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and units >= 3 and units <= 4 and ltv <= 60',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| 3-4 Units | -0.375 | -0.375 | -0.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 455, end: 455 },
      },
    ],
  },
  {
    name: "3-4 Units LTV 60.01-65% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and units >= 3 and units <= 4 and ltv > 60 and ltv <= 65',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| 3-4 Units | ... | -0.500 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 455, end: 455 },
      },
    ],
  },
  {
    name: "3-4 Units LTV 65.01-70% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and units >= 3 and units <= 4 and ltv > 65 and ltv <= 70',
    priceAdj: -0.625,
    citations: [
      {
        quote: "| 3-4 Units | ... | -0.625 | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 455, end: 455 },
      },
    ],
  },

  // Second Home (Non-Conforming)
  {
    name: "Second Home LTV <=55% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv <= 55',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| Second Home | -0.125 | -0.125 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },
  {
    name: "Second Home LTV 55.01-60% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv > 55 and ltv <= 60',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Second Home | ... | -0.250 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },
  {
    name: "Second Home LTV 60.01-65% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv > 60 and ltv <= 65',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| Second Home | ... | -0.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },
  {
    name: "Second Home LTV 65.01-70% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv > 65 and ltv <= 70',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Second Home | ... | -0.500 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },
  {
    name: "Second Home LTV 70.01-75% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv > 70 and ltv <= 75',
    priceAdj: -0.75,
    citations: [
      {
        quote: "| Second Home | ... | -0.750 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },
  {
    name: "Second Home LTV 75.01-80% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv > 75 and ltv <= 80',
    priceAdj: -1.25,
    citations: [
      {
        quote: "| Second Home | ... | -1.250 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },
  {
    name: "Second Home LTV 80.01-85% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv > 80 and ltv <= 85',
    priceAdj: -1.75,
    citations: [
      {
        quote: "| Second Home | ... | -1.750 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },
  {
    name: "Second Home LTV 85.01-90% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "secondHome" and ltv > 85 and ltv <= 90',
    priceAdj: -2.25,
    citations: [
      {
        quote: "| Second Home | ... | -2.250 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 456, end: 456 },
      },
    ],
  },

  // Investment (Non-Conforming)
  {
    name: "Investment LTV <=55% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "investment" and ltv <= 55',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| Investment | -0.500 | -0.500 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 457, end: 457 },
      },
    ],
  },
  {
    name: "Investment LTV 55.01-60% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "investment" and ltv > 55 and ltv <= 60',
    priceAdj: -0.875,
    citations: [
      {
        quote: "| Investment | ... | -0.875 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 457, end: 457 },
      },
    ],
  },
  {
    name: "Investment LTV 60.01-65% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "investment" and ltv > 60 and ltv <= 65',
    priceAdj: -1.5,
    citations: [
      {
        quote: "| Investment | ... | -1.500 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 457, end: 457 },
      },
    ],
  },
  {
    name: "Investment LTV 65.01-70% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and occupancy == "investment" and ltv > 65 and ltv <= 70',
    priceAdj: -2.25,
    citations: [
      {
        quote: "| Investment | ... | -2.250 | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 457, end: 457 },
      },
    ],
  },

  // Non-Warrantable Condo (Non-Conforming)
  {
    name: "Non-Warrantable Condo LTV <=80% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and propertyType == "nonWarrantableCondo" and ltv <= 80',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Non-War. Condo | -0.250 | ... (all LTV <=80%) |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 458, end: 458 },
      },
    ],
  },

  // No Escrow (Non-Conforming)
  {
    name: "No Escrows (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and escrowWaiver',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| No Escrows | -0.125 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 483, end: 483 },
      },
    ],
  },

  // DTI Adjustments (Non-Conforming)
  {
    name: "DTI 43.01-45% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and dti > 43 and dti <= 45',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| 43.01 to 45.00 | -0.125 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 488, end: 488 },
      },
    ],
  },
  {
    name: "DTI 45.01-47% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and dti > 45 and dti <= 47',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| 45.01 to 47.00 | -0.250 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 489, end: 489 },
      },
    ],
  },
  {
    name: "DTI > 47% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and dti > 47',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| >47.00 | -0.500 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 490, end: 490 },
      },
    ],
  },

  // ============================================================================
  // Loan-Level Rate Adjustments (All Programs)
  // ============================================================================

  {
    name: "LMIB Rate Discount",
    when: "isLMIB",
    rateAdj: -0.125,
    citations: [
      {
        quote: "| Low-To-Moderate Income Borrowers (LMIB) | -0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 498, end: 498 },
      },
    ],
  },
  {
    name: "LMIT Rate Discount",
    when: "isLMIT",
    rateAdj: -0.125,
    citations: [
      {
        quote: "| Low-To-Moderate Income Census Tract (LMIT) | -0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 499, end: 499 },
      },
    ],
  },
  {
    name: "MMCT Rate Discount (NC, SC, GA)",
    when: 'isMMCT and (propertyState == "NC" or propertyState == "SC" or propertyState == "GA")',
    rateAdj: -0.375,
    citations: [
      {
        quote:
          "| Majority-Minority Census Tract (MMCT) - NC, SC, GA | -0.375% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 500, end: 500 },
      },
    ],
  },
  {
    name: "MMCT Rate Discount (CA, MA, WI)",
    when: 'isMMCT and (propertyState == "CA" or propertyState == "MA" or propertyState == "WI")',
    rateAdj: -0.125,
    citations: [
      {
        quote:
          "| Majority-Minority Census Tract (MMCT) - CA, MA, WI | -0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 501, end: 501 },
      },
    ],
  },
  {
    name: "Additional CRA Adjustment (NC, SC, GA)",
    when: 'isLMIB and isMMCT and (propertyState == "NC" or propertyState == "SC" or propertyState == "GA")',
    rateAdj: -0.5,
    citations: [
      {
        quote: "| Additional CRA Adjustment - NC, SC, GA | -0.500% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 502, end: 502 },
      },
    ],
  },
  {
    name: "Additional CRA Adjustment (CA, MA, WI)",
    when: 'isLMIB and isMMCT and (propertyState == "CA" or propertyState == "MA" or propertyState == "WI")',
    rateAdj: -0.25,
    citations: [
      {
        quote: "| Additional CRA Adjustment - CA, MA, WI | -0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 503, end: 503 },
      },
    ],
  },

  // Loan Amount Rate Adjustments (Fixed Term Only)
  {
    name: "Loan Amount $1-$250K Rate Adjustment",
    when: 'loanType == "fixed" and loanAmount >= 1 and loanAmount <= 250000',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| $1 - $250,000 | 0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 509, end: 509 },
      },
    ],
  },
  {
    name: "Loan Amount $500K+ Rate Adjustment",
    when: 'loanType == "fixed" and loanAmount > 500000',
    rateAdj: -0.25,
    citations: [
      {
        quote: "| $500,001+ | -0.250% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 511, end: 511 },
      },
    ],
  },

  // Purchase Special (GA, NC, SC ONLY)
  {
    name: "Purchase Special (GA, NC, SC)",
    when: 'loanPurpose == "purchase" and (propertyState == "GA" or propertyState == "NC" or propertyState == "SC")',
    priceAdj: 0.375, // 这是 rebate，所以是正值
    citations: [
      {
        quote: "| Purchase Special (GA, NC, SC ONLY) | 0.375 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 521, end: 521 },
      },
    ],
  },

  // County/State Adjustments (Fixed Term Only)
  {
    name: "Los Angeles County, CA",
    when: 'loanType == "fixed" and propertyCounty == "Los Angeles" and propertyState == "CA"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Los Angeles County, CA | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 538, end: 538 },
      },
    ],
  },
  {
    name: "Orange County, CA",
    when: 'loanType == "fixed" and propertyCounty == "Orange" and propertyState == "CA"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Orange County, CA | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 539, end: 539 },
      },
    ],
  },
  {
    name: "San Francisco County, CA",
    when: 'loanType == "fixed" and propertyCounty == "San Francisco" and propertyState == "CA"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| San Francisco County, CA | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 540, end: 540 },
      },
    ],
  },
  {
    name: "San Mateo County, CA",
    when: 'loanType == "fixed" and propertyCounty == "San Mateo" and propertyState == "CA"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| San Mateo County, CA | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 541, end: 541 },
      },
    ],
  },
  {
    name: "Santa Clara County, CA",
    when: 'loanType == "fixed" and propertyCounty == "Santa Clara" and propertyState == "CA"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Santa Clara County, CA | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 542, end: 542 },
      },
    ],
  },
  {
    name: "Suffolk County, MA (Boston)",
    when: 'loanType == "fixed" and propertyCounty == "Suffolk" and propertyState == "MA"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Suffolk County, MA (Boston) | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 543, end: 543 },
      },
    ],
  },
  {
    name: "Mecklenburg County, NC (Charlotte)",
    when: 'loanType == "fixed" and propertyCounty == "Mecklenburg" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Mecklenburg County, NC (Charlotte) | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 544, end: 544 },
      },
    ],
  },
  {
    name: "Wake County, NC (Raleigh)",
    when: 'loanType == "fixed" and propertyCounty == "Wake" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Wake County, NC (Raleigh) | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 545, end: 545 },
      },
    ],
  },
  {
    name: "Durham County, NC",
    when: 'loanType == "fixed" and propertyCounty == "Durham" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Durham County, NC | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 546, end: 546 },
      },
    ],
  },
  {
    name: "Orange County, NC (Chapel Hill)",
    when: 'loanType == "fixed" and propertyCounty == "Orange" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Orange County, NC (Chapel Hill) | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 547, end: 547 },
      },
    ],
  },
  {
    name: "Chatham County, NC",
    when: 'loanType == "fixed" and propertyCounty == "Chatham" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Chatham County, NC | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 548, end: 548 },
      },
    ],
  },
  {
    name: "Franklin County, NC",
    when: 'loanType == "fixed" and propertyCounty == "Franklin" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Franklin County, NC | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 549, end: 549 },
      },
    ],
  },
  {
    name: "Johnston County, NC",
    when: 'loanType == "fixed" and propertyCounty == "Johnston" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Johnston County, NC | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 550, end: 550 },
      },
    ],
  },
  {
    name: "Buncombe County, NC",
    when: 'loanType == "fixed" and propertyCounty == "Buncombe" and propertyState == "NC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Buncombe County, NC | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 551, end: 551 },
      },
    ],
  },
  {
    name: "Greenville County, SC",
    when: 'loanType == "fixed" and propertyCounty == "Greenville" and propertyState == "SC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Greenville County, SC | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 552, end: 552 },
      },
    ],
  },
  {
    name: "Charleston County, SC",
    when: 'loanType == "fixed" and propertyCounty == "Charleston" and propertyState == "SC"',
    priceAdj: 0.25,
    citations: [
      {
        quote: "| Charleston County, SC | 0.25 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 553, end: 553 },
      },
    ],
  },

  // ============================================================================
  // ARM (Non-Conforming) - Feature Adjustments (Rate Adjustments)
  // ============================================================================

  // Interest Only (ARM)
  {
    name: "Interest Only LTV ≤60% (ARM)",
    when: 'loanType == "arm" and isInterestOnly and ltv <= 60',
    rateAdj: 0.175,
    citations: [
      {
        quote: "| Interest Only | 0.175% | 0.175% | 0.175% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 496, end: 496 },
      },
    ],
  },
  {
    name: "Interest Only LTV 60.01-70% (ARM)",
    when: 'loanType == "arm" and isInterestOnly and ltv > 60 and ltv <= 70',
    rateAdj: 0.2,
    citations: [
      {
        quote: "| Interest Only | ... | 0.200% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 496, end: 496 },
      },
    ],
  },
  {
    name: "Interest Only LTV 70.01-75% (ARM)",
    when: 'loanType == "arm" and isInterestOnly and ltv > 70 and ltv <= 75',
    rateAdj: 0.225,
    citations: [
      {
        quote: "| Interest Only | ... | 0.225% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 496, end: 496 },
      },
    ],
  },
  {
    name: "Interest Only LTV 75.01-80% (ARM)",
    when: 'loanType == "arm" and isInterestOnly and ltv > 75 and ltv <= 80',
    rateAdj: 0.3,
    citations: [
      {
        quote: "| Interest Only | ... | 0.300% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 496, end: 496 },
      },
    ],
  },

  // Second Home (ARM)
  {
    name: "Second Home LTV ≤60% (ARM)",
    when: 'loanType == "arm" and occupancy == "secondHome" and ltv <= 60',
    rateAdj: 0.1,
    citations: [
      {
        quote: "| Second Home | 0.100% | 0.100% | 0.100% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 497, end: 497 },
      },
    ],
  },
  {
    name: "Second Home LTV 60.01-70% (ARM)",
    when: 'loanType == "arm" and occupancy == "secondHome" and ltv > 60 and ltv <= 70',
    rateAdj: 0.2,
    citations: [
      {
        quote: "| Second Home | ... | 0.200% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 497, end: 497 },
      },
    ],
  },
  {
    name: "Second Home LTV 70.01-75% (ARM)",
    when: 'loanType == "arm" and occupancy == "secondHome" and ltv > 70 and ltv <= 75',
    rateAdj: 0.35,
    citations: [
      {
        quote: "| Second Home | ... | 0.350% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 497, end: 497 },
      },
    ],
  },
  {
    name: "Second Home LTV 75.01-80% (ARM)",
    when: 'loanType == "arm" and occupancy == "secondHome" and ltv > 75 and ltv <= 80',
    rateAdj: 0.5,
    citations: [
      {
        quote: "| Second Home | ... | 0.500% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 497, end: 497 },
      },
    ],
  },

  // Investment Property (ARM)
  {
    name: "Investment LTV ≤60% (ARM)",
    when: 'loanType == "arm" and occupancy == "investment" and ltv <= 60',
    rateAdj: 2.0,
    citations: [
      {
        quote: "| Investment Property | 2.000% | 2.000% | 2.000% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 498, end: 498 },
      },
    ],
  },
  {
    name: "Investment LTV 60.01-70% (ARM)",
    when: 'loanType == "arm" and occupancy == "investment" and ltv > 60 and ltv <= 70',
    rateAdj: 3.0,
    citations: [
      {
        quote: "| Investment Property | ... | 3.000% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 498, end: 498 },
      },
    ],
  },
  {
    name: "Investment LTV 70.01-75% (ARM)",
    when: 'loanType == "arm" and occupancy == "investment" and ltv > 70 and ltv <= 75',
    rateAdj: 4.0,
    citations: [
      {
        quote: "| Investment Property | ... | 4.000% | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 498, end: 498 },
      },
    ],
  },
  {
    name: "Investment LTV 75.01-80% (ARM)",
    when: 'loanType == "arm" and occupancy == "investment" and ltv > 75 and ltv <= 80',
    rateAdj: 5.0,
    citations: [
      {
        quote: "| Investment Property | ... | 5.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 498, end: 498 },
      },
    ],
  },

  // Condo (ARM)
  {
    name: "Condo (ARM)",
    when: 'loanType == "arm" and propertyType == "condo"',
    rateAdj: 0.05,
    citations: [
      {
        quote: "| Condo | 0.050% | ... (all LTV) |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 499, end: 499 },
      },
    ],
  },

  // 2-4 Unit (ARM)
  {
    name: "2-4 Unit (ARM)",
    when: 'loanType == "arm" and units >= 2 and units <= 4',
    rateAdj: 0.1,
    citations: [
      {
        quote: "| 2-4 Unit | 0.100% | ... (all LTV) |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 500, end: 500 },
      },
    ],
  },

  // Loan Amount $832,750 - $950,000 (ARM)
  {
    name: "Loan Amount $832,750-$950,000 (ARM)",
    when: 'loanType == "arm" and loanAmount >= 832750 and loanAmount <= 950000',
    rateAdj: -0.125,
    citations: [
      {
        quote: "| Loan Amt $832,750 - $950,000 | -0.125% | ... (all LTV) |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 501, end: 501 },
      },
    ],
  },

  // ============================================================================
  // ARM (Non-Conforming) - FICO/LTV (Purchase) - Rate Adjustments
  // ============================================================================

  // FICO ≥780 (ARM Purchase)
  {
    name: "ARM Purchase FICO ≥780",
    when: 'loanType == "arm" and loanPurpose == "purchase" and ficoScore >= 780',
    rateAdj: -0.15,
    citations: [
      {
        quote: "| ≥780 | -0.150% | -0.150% | -0.150% | -0.150% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 507, end: 507 },
      },
    ],
  },
  // FICO 740-779 (ARM Purchase)
  {
    name: "ARM Purchase FICO 740-779",
    when: 'loanType == "arm" and loanPurpose == "purchase" and ficoScore >= 740 and ficoScore <= 779',
    rateAdj: -0.15,
    citations: [
      {
        quote: "| 740-779 | -0.150% | -0.150% | -0.150% | -0.150% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 508, end: 508 },
      },
    ],
  },
  // FICO 720-739 (ARM Purchase)
  {
    name: "ARM Purchase FICO 720-739",
    when: 'loanType == "arm" and loanPurpose == "purchase" and ficoScore >= 720 and ficoScore <= 739',
    rateAdj: -0.1,
    citations: [
      {
        quote: "| 720-739 | -0.100% | -0.100% | -0.100% | -0.100% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 509, end: 509 },
      },
    ],
  },
  // FICO 700-719 (ARM Purchase)
  {
    name: "ARM Purchase FICO 700-719",
    when: 'loanType == "arm" and loanPurpose == "purchase" and ficoScore >= 700 and ficoScore <= 719',
    rateAdj: -0.1,
    citations: [
      {
        quote: "| 700-719 | -0.100% | -0.100% | -0.100% | -0.100% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 510, end: 510 },
      },
    ],
  },
  // FICO 680-699 (ARM Purchase)
  {
    name: "ARM Purchase FICO 680-699",
    when: 'loanType == "arm" and loanPurpose == "purchase" and ficoScore >= 680 and ficoScore <= 699',
    rateAdj: -0.05,
    citations: [
      {
        quote: "| 680-699 | -0.050% | -0.050% | -0.050% | -0.050% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 511, end: 511 },
      },
    ],
  },

  // ============================================================================
  // ARM (Non-Conforming) - FICO/LTV (Limited Cash Out Refinance) - Rate Adjustments
  // ============================================================================

  // FICO ≥780, LTV ≤75% (ARM LCOR)
  {
    name: "ARM LCOR FICO ≥780, LTV ≤75%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 780 and ltv <= 75',
    rateAdj: -0.1,
    citations: [
      {
        quote: "| ≥780 | -0.100% | -0.100% | -0.100% | -0.100% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 517, end: 517 },
      },
    ],
  },
  {
    name: "ARM LCOR FICO ≥780, LTV 75.01-80%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 780 and ltv > 75 and ltv <= 80',
    rateAdj: -0.1,
    citations: [
      {
        quote: "| ≥780 | ... | -0.100% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 517, end: 517 },
      },
    ],
  },
  // FICO 740-779 (ARM LCOR)
  {
    name: "ARM LCOR FICO 740-779, LTV ≤75%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 740 and ficoScore <= 779 and ltv <= 75',
    rateAdj: -0.1,
    citations: [
      {
        quote: "| 740-779 | -0.100% | -0.100% | -0.100% | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 518, end: 518 },
      },
    ],
  },
  {
    name: "ARM LCOR FICO 740-779, LTV 75.01-80%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 740 and ficoScore <= 779 and ltv > 75 and ltv <= 80',
    rateAdj: 0,
    citations: [
      {
        quote: "| 740-779 | ... | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 518, end: 518 },
      },
    ],
  },
  // FICO 720-739 (ARM LCOR)
  {
    name: "ARM LCOR FICO 720-739, LTV ≤70%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 720 and ficoScore <= 739 and ltv <= 70',
    rateAdj: -0.1,
    citations: [
      {
        quote: "| 720-739 | -0.100% | -0.100% | -0.050% | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 519, end: 519 },
      },
    ],
  },
  {
    name: "ARM LCOR FICO 720-739, LTV 70.01-75%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 720 and ficoScore <= 739 and ltv > 70 and ltv <= 75',
    rateAdj: -0.05,
    citations: [
      {
        quote: "| 720-739 | ... | -0.050% | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 519, end: 519 },
      },
    ],
  },
  {
    name: "ARM LCOR FICO 720-739, LTV 75.01-80%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 720 and ficoScore <= 739 and ltv > 75 and ltv <= 80',
    rateAdj: 0,
    citations: [
      {
        quote: "| 720-739 | ... | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 519, end: 519 },
      },
    ],
  },
  // FICO 700-719 (ARM LCOR)
  {
    name: "ARM LCOR FICO 700-719, LTV ≤70%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 700 and ficoScore <= 719 and ltv <= 70',
    rateAdj: -0.05,
    citations: [
      {
        quote: "| 700-719 | -0.050% | -0.050% | 0.000% | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 520, end: 520 },
      },
    ],
  },
  {
    name: "ARM LCOR FICO 700-719, LTV 70.01-80%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 700 and ficoScore <= 719 and ltv > 70 and ltv <= 80',
    rateAdj: 0,
    citations: [
      {
        quote: "| 700-719 | ... | 0.000% | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 520, end: 520 },
      },
    ],
  },
  // FICO 680-699 (ARM LCOR)
  {
    name: "ARM LCOR FICO 680-699, LTV ≤70%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 680 and ficoScore <= 699 and ltv <= 70',
    rateAdj: -0.05,
    citations: [
      {
        quote: "| 680-699 | -0.050% | -0.050% | 0.000% | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 521, end: 521 },
      },
    ],
  },
  {
    name: "ARM LCOR FICO 680-699, LTV 70.01-80%",
    when: 'loanType == "arm" and loanPurpose == "refinance" and ficoScore >= 680 and ficoScore <= 699 and ltv > 70 and ltv <= 80',
    rateAdj: 0,
    citations: [
      {
        quote: "| 680-699 | ... | 0.000% | 0.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 521, end: 521 },
      },
    ],
  },

  // ============================================================================
  // ARM (Non-Conforming) - FICO/LTV (Cash Out Refinance) - Rate Adjustments
  // ============================================================================

  // FICO ≥780 (ARM CashOut)
  {
    name: "ARM CashOut FICO ≥780, LTV ≤70%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 780 and ltv <= 70',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| ≥780 | 0.250% | 0.250% | 1.000% | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 527, end: 527 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO ≥780, LTV 70.01-75%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 780 and ltv > 70 and ltv <= 75',
    rateAdj: 1.0,
    citations: [
      {
        quote: "| ≥780 | ... | 1.000% | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 527, end: 527 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO ≥780, LTV 75.01-80%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 780 and ltv > 75 and ltv <= 80',
    rateAdj: 2.0,
    citations: [
      {
        quote: "| ≥780 | ... | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 527, end: 527 },
      },
    ],
  },
  // FICO 740-779 (ARM CashOut) - same as ≥780
  {
    name: "ARM CashOut FICO 740-779, LTV ≤70%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 740 and ficoScore <= 779 and ltv <= 70',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| 740-779 | 0.250% | 0.250% | 1.000% | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 528, end: 528 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO 740-779, LTV 70.01-75%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 740 and ficoScore <= 779 and ltv > 70 and ltv <= 75',
    rateAdj: 1.0,
    citations: [
      {
        quote: "| 740-779 | ... | 1.000% | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 528, end: 528 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO 740-779, LTV 75.01-80%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 740 and ficoScore <= 779 and ltv > 75 and ltv <= 80',
    rateAdj: 2.0,
    citations: [
      {
        quote: "| 740-779 | ... | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 528, end: 528 },
      },
    ],
  },
  // FICO 720-739 (ARM CashOut) - same as above
  {
    name: "ARM CashOut FICO 720-739, LTV ≤70%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 720 and ficoScore <= 739 and ltv <= 70',
    rateAdj: 0.25,
    citations: [
      {
        quote: "| 720-739 | 0.250% | 0.250% | 1.000% | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 529, end: 529 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO 720-739, LTV 70.01-75%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 720 and ficoScore <= 739 and ltv > 70 and ltv <= 75',
    rateAdj: 1.0,
    citations: [
      {
        quote: "| 720-739 | ... | 1.000% | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 529, end: 529 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO 720-739, LTV 75.01-80%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 720 and ficoScore <= 739 and ltv > 75 and ltv <= 80',
    rateAdj: 2.0,
    citations: [
      {
        quote: "| 720-739 | ... | 2.000% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 529, end: 529 },
      },
    ],
  },
  // FICO 700-719 (ARM CashOut) - higher rates, N/A for high LTV
  {
    name: "ARM CashOut FICO 700-719, LTV ≤60%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 700 and ficoScore <= 719 and ltv <= 60',
    rateAdj: 1.0,
    citations: [
      {
        quote: "| 700-719 | 1.000% | 0.750% | N/A | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 530, end: 530 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO 700-719, LTV 60.01-70%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 700 and ficoScore <= 719 and ltv > 60 and ltv <= 70',
    rateAdj: 0.75,
    citations: [
      {
        quote: "| 700-719 | 1.000% | 0.750% | N/A | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 530, end: 530 },
      },
    ],
  },
  // FICO 680-699 (ARM CashOut) - highest rates, N/A for high LTV
  {
    name: "ARM CashOut FICO 680-699, LTV ≤60%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 680 and ficoScore <= 699 and ltv <= 60',
    rateAdj: 2.0,
    citations: [
      {
        quote: "| 680-699 | 2.000% | 1.000% | N/A | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 531, end: 531 },
      },
    ],
  },
  {
    name: "ARM CashOut FICO 680-699, LTV 60.01-70%",
    when: 'loanType == "arm" and loanPurpose == "cashOut" and ficoScore >= 680 and ficoScore <= 699 and ltv > 60 and ltv <= 70',
    rateAdj: 1.0,
    citations: [
      {
        quote: "| 680-699 | 2.000% | 1.000% | N/A | N/A |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 531, end: 531 },
      },
    ],
  },

  // ============================================================================
  // ARM (Non-Conforming) - Purchase Special & Escrow Waiver
  // ============================================================================

  // ARM Purchase Special (GA, NC, SC)
  {
    name: "ARM Purchase Special (GA, NC, SC)",
    when: 'loanType == "arm" and loanPurpose == "purchase" and (propertyState == "GA" or propertyState == "NC" or propertyState == "SC")',
    rateAdj: -0.125,
    citations: [
      {
        quote: "| ARM Purchase Special (GA, NC, SC ONLY) | -0.125% |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 537, end: 537 },
      },
    ],
  },

  // ARM Escrow Waiver
  {
    name: "Escrow Waiver (ARM)",
    when: 'loanType == "arm" and escrowWaiver',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| Escrow Waiver | -0.250 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 542, end: 542 },
      },
    ],
  },

  // ============================================================================
  // Non-Conforming - State Adjustments (High LTV)
  // ============================================================================

  // FL, NV - LTV 80.01-85%
  {
    name: "State FL/NV LTV 80.01-85% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and (propertyState == "FL" or propertyState == "NV") and ltv > 80 and ltv <= 85',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| FL, NV | ... | -0.500 | -1.000 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 475, end: 475 },
      },
    ],
  },
  // FL, NV - LTV 85.01-90%
  {
    name: "State FL/NV LTV 85.01-90% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and (propertyState == "FL" or propertyState == "NV") and ltv > 85 and ltv <= 90',
    priceAdj: -1.0,
    citations: [
      {
        quote: "| FL, NV | ... | -1.000 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 475, end: 475 },
      },
    ],
  },
  // CA - LTV 85.01-90%
  {
    name: "State CA LTV 85.01-90% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and propertyState == "CA" and ltv > 85 and ltv <= 90',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| CA | ... | -0.500 |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 476, end: 476 },
      },
    ],
  },

  // ============================================================================
  // Non-Conforming - Loan Amount Adjustments (High Balance)
  // ============================================================================

  // $3,000,001 - $3,500,000
  {
    name: "Loan Amount $3M-$3.5M, LTV ≤55% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and loanAmount > 3000000 and loanAmount <= 3500000 and ltv <= 55',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| 3,000,001-3,500,000 | -0.250 | -0.250 | -0.375 | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 464, end: 464 },
      },
    ],
  },
  {
    name: "Loan Amount $3M-$3.5M, LTV 55.01-60% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and loanAmount > 3000000 and loanAmount <= 3500000 and ltv > 55 and ltv <= 60',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| 3,000,001-3,500,000 | -0.250 | -0.250 | -0.375 | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 464, end: 464 },
      },
    ],
  },
  // $2,500,001 - $3,000,000
  {
    name: "Loan Amount $2.5M-$3M, LTV ≤55% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and loanAmount > 2500000 and loanAmount <= 3000000 and ltv <= 55',
    priceAdj: -0.125,
    citations: [
      {
        quote: "| 2,500,001-3,000,000 | -0.125 | -0.125 | -0.250 | -0.375 | -0.500 | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 465, end: 465 },
      },
    ],
  },
  {
    name: "Loan Amount $2.5M-$3M, LTV 55.01-60% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and loanAmount > 2500000 and loanAmount <= 3000000 and ltv > 55 and ltv <= 60',
    priceAdj: -0.25,
    citations: [
      {
        quote: "| 2,500,001-3,000,000 | ... | -0.250 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 465, end: 465 },
      },
    ],
  },
  {
    name: "Loan Amount $2.5M-$3M, LTV 60.01-65% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and loanAmount > 2500000 and loanAmount <= 3000000 and ltv > 60 and ltv <= 65',
    priceAdj: -0.375,
    citations: [
      {
        quote: "| 2,500,001-3,000,000 | ... | -0.375 | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 465, end: 465 },
      },
    ],
  },
  {
    name: "Loan Amount $2.5M-$3M, LTV 65.01-70% (Non-Conforming)",
    when: 'loanProgram == "nonConforming" and loanType == "fixed" and loanAmount > 2500000 and loanAmount <= 3000000 and ltv > 65 and ltv <= 70',
    priceAdj: -0.5,
    citations: [
      {
        quote: "| 2,500,001-3,000,000 | ... | -0.500 | N/A | ... |",
        docPath: RATE_SHEET_DOC_PATH,
        lines: { start: 465, end: 465 },
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
 * Celebrity 产品延期费用（根据行业标准估计）
 */
export const CELEBRITY_EXTENSION_COSTS: ExtensionCost[] = [
  { days: 10, cost: 0.1, category: "all" },
  { days: 15, cost: 0.25, category: "all" },
  { days: 20, cost: 0.4, category: "all" },
  { days: 30, cost: 0.7, category: "all" },
];

// ============================================================================
// 锁定期调整
// ============================================================================

/**
 * 锁定期价格调整
 *
 * 不同产品有不同的默认锁定期：
 * - Conforming/FHA: 30-Day 为基准
 * - Non-Conforming Fixed: 45-Day 为基准（没有 30-Day）
 * - Community Opp: 60-Day Only
 */
export const CELEBRITY_LOCK_DAY_PRICES: Record<number, LockDayPrice> = {
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
export const CELEBRITY_REQUIRED_FIELDS = {
  ficoScore: {
    type: "number",
    description: "Borrower FICO score (620-850)",
    example: 720,
  },
  ltv: {
    type: "number",
    description: "Loan-to-Value ratio (percentage, e.g., 70 for 70%)",
    example: 70,
  },
  loanAmount: {
    type: "number",
    description: "Loan amount in dollars",
    example: 500000,
  },
  loanProgram: {
    type: "enum",
    values: ["conforming", "fha", "communityOpp", "nonConforming"],
    description:
      "Loan program type: Conforming, FHA, Community Opportunity, or Non-Conforming",
    example: "conforming",
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
  occupancy: {
    type: "enum",
    values: ["primary", "secondHome", "investment"],
    description: "Property occupancy type",
    example: "primary",
  },
  propertyType: {
    type: "enum",
    values: [
      "sfr",
      "pud",
      "condo",
      "multiUnit",
      "manufactured",
      "nonWarrantableCondo",
    ],
    description: "Property type",
    example: "sfr",
  },
  propertyState: {
    type: "enum",
    values: ["CA", "MA", "GA", "NC", "SC", "VA", "WI", "FL", "NV"],
    description: "Property state (Celebrity supports limited states)",
    example: "CA",
  },
  propertyCounty: {
    type: "enum",
    values: [
      "Los Angeles",
      "Orange",
      "San Francisco",
      "San Mateo",
      "Santa Clara",
      "Suffolk",
      "Mecklenburg",
      "Wake",
      "Durham",
      "Chatham",
      "Franklin",
      "Johnston",
      "Buncombe",
      "Greenville",
      "Charleston",
    ],
    description: "Property county (for county-specific adjustments)",
    example: "Los Angeles",
  },
  units: {
    type: "number",
    description: "Number of units (1-4)",
    example: 1,
  },
  dti: {
    type: "number",
    description: "Debt-to-Income ratio (percentage, for Non-Conforming only)",
    example: 40,
  },
  hasSubordinateFinancing: {
    type: "boolean",
    description: "Whether there is subordinate financing (CLTV > LTV)",
    example: false,
  },
  escrowWaiver: {
    type: "boolean",
    description: "Whether escrow is waived",
    example: false,
  },
  isHighBalance: {
    type: "boolean",
    description: "Whether the loan is High Balance (FHA/Community Opp)",
    example: false,
  },
  isLMIB: {
    type: "boolean",
    description:
      "Low-to-Moderate Income Borrower (income < 80% of county MFI)",
    example: false,
  },
  isLMIT: {
    type: "boolean",
    description:
      "Low-to-Moderate Income Census Tract (tract MFI < 80% of county MFI)",
    example: false,
  },
  isMMCT: {
    type: "boolean",
    description: "Majority-Minority Census Tract (> 50% minority population)",
    example: false,
  },
  isInterestOnly: {
    type: "boolean",
    description: "Whether the loan is interest-only (ARM only)",
    example: false,
  },
} as const;

// ============================================================================
// 完整配置导出
// ============================================================================

/**
 * Celebrity 产品完整定价配置
 */
export const CELEBRITY_PRICING_CONFIG = {
  productName: CELEBRITY_RATE_SHEET.productName,
  baseRates: CELEBRITY_BASE_RATES,
  adjustments: CELEBRITY_ADJUSTMENTS,
  llpaMatrices: CELEBRITY_LLPA_MATRICES,
  stackingRules: [],
  extensionCosts: CELEBRITY_EXTENSION_COSTS,
  rateSheets: CELEBRITY_RATE_SHEET.rateSheets,
  lockDayPrices: CELEBRITY_LOCK_DAY_PRICES,
} as const;
