/**
 * 定价核心引擎测试
 *
 * 从 runPricingSOP/__tests__/definition.test.ts 迁移
 */

import { describe, it, expect } from "vitest";
import { runPricingSOPCore, extractFieldsFromExpression, type SOPCoreInput } from "../engine";
import { ENGINE_DEFAULTS } from "../types";

// ============================================================================
// Test Fixtures
// ============================================================================

const BASE_RATES = [
  { category: "30Yr Fixed", rate: 5.875, price: 100 },
  { category: "30Yr Fixed", rate: 6.0, price: 100.5 },
];

const DEFAULT_INPUT: SOPCoreInput = {
  baseRates: BASE_RATES,
  adjustments: [],
  stackingRules: [],
  extensionCosts: [],
  fieldValues: {},
  lockDays: ENGINE_DEFAULTS.lockDays,
  extensionDays: ENGINE_DEFAULTS.extensionDays,
};

// ============================================================================
// 字段提取
// ============================================================================

describe("extractFieldsFromExpression", () => {
  it("should extract simple field", () => {
    expect(extractFieldsFromExpression("ficoScore < 700")).toEqual(["ficoScore"]);
  });

  it("should extract multiple fields", () => {
    const fields = extractFieldsFromExpression('ltv > 80 and loanPurpose == "cashOut"');
    expect(fields).toContain("ltv");
    expect(fields).toContain("loanPurpose");
    expect(fields).toHaveLength(2);
  });

  it("should exclude filtrex keywords", () => {
    const fields = extractFieldsFromExpression("ficoScore < 700 and ltv > 80 or not isRefinance");
    expect(fields).not.toContain("and");
    expect(fields).not.toContain("or");
    expect(fields).not.toContain("not");
  });

  it("should exclude string literals", () => {
    const fields = extractFieldsFromExpression('loanPurpose == "purchase"');
    expect(fields).toContain("loanPurpose");
    expect(fields).not.toContain("purchase");
  });

  it("should handle in() expression", () => {
    const fields = extractFieldsFromExpression('propertyType in ("condo", "pud")');
    expect(fields).toContain("propertyType");
    expect(fields).not.toContain("condo");
    expect(fields).not.toContain("pud");
  });
});

// ============================================================================
// 缺失字段跳过逻辑
// ============================================================================

describe("missing field skip behavior", () => {
  it("should skip adjustment when referenced field is missing", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "LTV > 80%", when: "ltv > 80", priceAdj: -0.5 },
      ],
      fieldValues: {}, // 没有 ltv
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(0);
    expect(result.skippedAdjustments).toHaveLength(1);
    expect(result.skippedAdjustments![0]).toEqual({
      name: "LTV > 80%",
      reason: "missing_field",
      missingFields: ["ltv"],
      expression: "ltv > 80",
      priceAdj: -0.5,
      rateAdj: undefined,
    });
  });

  it("should skip when one of multiple fields is missing", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "Low FICO + High LTV", when: "ficoScore < 700 and ltv > 75", priceAdj: -1.0 },
      ],
      fieldValues: { ficoScore: 680 }, // 有 ficoScore，但缺 ltv
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(0);
    expect(result.skippedAdjustments).toHaveLength(1);
    expect(result.skippedAdjustments![0]).toEqual({
      name: "Low FICO + High LTV",
      reason: "missing_field",
      missingFields: ["ltv"],
      expression: "ficoScore < 700 and ltv > 75",
      priceAdj: -1.0,
      rateAdj: undefined,
    });
  });

  it("should report all missing fields when multiple are absent", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "Complex Rule", when: "ficoScore < 700 and ltv > 75 and not isForeignNational", priceAdj: -1.0 },
      ],
      fieldValues: {}, // 全部缺失
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(0);
    expect(result.skippedAdjustments).toHaveLength(1);
    expect(result.skippedAdjustments![0].name).toBe("Complex Rule");
    expect(result.skippedAdjustments![0].reason).toBe("missing_field");
    expect(result.skippedAdjustments![0].missingFields).toContain("ficoScore");
    expect(result.skippedAdjustments![0].missingFields).toContain("ltv");
    expect(result.skippedAdjustments![0].missingFields).toContain("isForeignNational");
  });

  it("should not skip when all fields are provided", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "LTV > 80%", when: "ltv > 80", priceAdj: -0.5 },
      ],
      fieldValues: { ltv: 85 },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(1);
    expect(result.skippedAdjustments).toBeUndefined();
  });

  it("should handle mix of provided and missing fields across adjustments", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "FICO < 700", when: "ficoScore < 700", priceAdj: -0.5 },
        { name: "LTV > 80%", when: "ltv > 80", priceAdj: -0.25 },
      ],
      fieldValues: { ficoScore: 680 }, // 只有 ficoScore，没有 ltv
    });

    expect(result.success).toBe(true);
    // FICO < 700 应触发，LTV > 80% 应跳过
    expect(result.options![0].adjustments).toHaveLength(1);
    expect(result.options![0].adjustments[0].name).toBe("FICO < 700");
    expect(result.skippedAdjustments).toHaveLength(1);
    expect(result.skippedAdjustments![0]).toEqual({
      name: "LTV > 80%",
      reason: "missing_field",
      missingFields: ["ltv"],
      expression: "ltv > 80",
      priceAdj: -0.25,
      rateAdj: undefined,
    });
  });

  it("should aggregate skipped adjustments across multiple base rates", () => {
    const result = runPricingSOPCore({
      baseRates: [
        { category: "30Yr Fixed", rate: 5.875, price: 100 },
        { category: "15Yr Fixed", rate: 5.5, price: 100 },
      ],
      adjustments: [
        { name: "LTV > 80%", when: "ltv > 80", priceAdj: -0.5 },
      ],
      stackingRules: [],
      extensionCosts: [],
      fieldValues: {},
      lockDays: ENGINE_DEFAULTS.lockDays,
      extensionDays: ENGINE_DEFAULTS.extensionDays,
    });

    expect(result.success).toBe(true);
    // 虽然有 2 个 base rates，但 skippedAdjustments 应该去重
    expect(result.skippedAdjustments).toHaveLength(1);
    expect(result.skippedAdjustments![0].name).toBe("LTV > 80%");
  });

  it("should correctly identify missing boolean field in 'not' expression", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "FICO < 700 (non-FN)", when: "ficoScore < 700 and not isForeignNational", priceAdj: -0.375 },
      ],
      fieldValues: { ficoScore: 680 }, // 有 ficoScore，但缺 isForeignNational
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(0);
    expect(result.skippedAdjustments).toHaveLength(1);
    expect(result.skippedAdjustments![0]).toEqual({
      name: "FICO < 700 (non-FN)",
      reason: "missing_field",
      missingFields: ["isForeignNational"],
      expression: "ficoScore < 700 and not isForeignNational",
      priceAdj: -0.375,
      rateAdj: undefined,
    });
  });

  it("should trigger adjustment when boolean field is explicitly false", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "FICO < 700 (non-FN)", when: "ficoScore < 700 and not isForeignNational", priceAdj: -0.375 },
      ],
      fieldValues: { ficoScore: 680, isForeignNational: false },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(1);
    expect(result.options![0].adjustments[0].name).toBe("FICO < 700 (non-FN)");
    expect(result.skippedAdjustments).toBeUndefined();
  });
});

// ============================================================================
// 表达式评估
// ============================================================================

describe("expression evaluation", () => {
  it("should apply adjustment when expression is true", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "LTV > 80%", when: "ltv > 80", priceAdj: -0.5 },
      ],
      fieldValues: { ltv: 85 },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(1);
    expect(result.options![0].adjustments[0].name).toBe("LTV > 80%");
  });

  it("should skip adjustment when expression is false", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "LTV > 80%", when: "ltv > 80", priceAdj: -0.5 },
      ],
      fieldValues: { ltv: 75 },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(0);
  });

  it("should handle AND expression", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "Low FICO + High LTV", when: "ficoScore < 700 and ltv > 75", priceAdj: -1.0 },
      ],
      fieldValues: { ficoScore: 680, ltv: 80 },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(1);
  });

  it("should handle OR expression", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "Risk Factor", when: "ficoScore < 660 or ltv > 90", priceAdj: -0.75 },
      ],
      fieldValues: { ficoScore: 720, ltv: 95 },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(1);
  });

  it("should handle string match with ==", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "Cash-Out", when: 'loanPurpose == "cashOut"', priceAdj: -0.75 },
      ],
      fieldValues: { loanPurpose: "cashOut" },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(1);
  });

  it("should handle in() for list matching", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "Condo/PUD", when: 'propertyType in ("condo", "pud")', priceAdj: -0.5 },
      ],
      fieldValues: { propertyType: "condo" },
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(1);
  });

  it("should handle multiple adjustments", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      adjustments: [
        { name: "FICO < 700", when: "ficoScore < 700", priceAdj: -0.5 },
        { name: "LTV > 75", when: "ltv > 75", priceAdj: -0.25 },
        { name: "Cash-Out", when: 'loanPurpose == "cashOut"', priceAdj: -0.75 },
      ],
      fieldValues: { ficoScore: 680, ltv: 80, loanPurpose: "purchase" },
    });

    expect(result.success).toBe(true);
    // FICO < 700 和 LTV > 75 应触发，Cash-Out 不应触发
    expect(result.options![0].adjustments).toHaveLength(2);
  });
});

// ============================================================================
// 叠加规则
// ============================================================================

describe("stacking rules", () => {
  describe("mutex", () => {
    it("should keep only the first matching adjustment", () => {
      const result = runPricingSOPCore({
        ...DEFAULT_INPUT,
        adjustments: [
          { name: "FICO Tier 1", when: "ficoScore < 620", priceAdj: -2.0 },
          { name: "FICO Tier 2", when: "ficoScore < 660", priceAdj: -1.0 },
          { name: "FICO Tier 3", when: "ficoScore < 700", priceAdj: -0.5 },
        ],
        stackingRules: [
          { type: "mutex", members: ["FICO Tier 1", "FICO Tier 2", "FICO Tier 3"] },
        ],
        fieldValues: { ficoScore: 650 },
      });

      expect(result.success).toBe(true);
      expect(result.options![0].adjustments).toHaveLength(1);
      expect(result.options![0].adjustments[0].name).toBe("FICO Tier 2");
    });
  });

  describe("max-one", () => {
    it("should keep adjustment with largest effect", () => {
      const result = runPricingSOPCore({
        ...DEFAULT_INPUT,
        adjustments: [
          { name: "Small", when: "ltv > 70", priceAdj: -0.25 },
          { name: "Medium", when: "ltv > 75", priceAdj: -0.5 },
          { name: "Large", when: "ltv > 80", priceAdj: -1.0 },
        ],
        stackingRules: [
          { type: "max-one", members: ["Small", "Medium", "Large"] },
        ],
        fieldValues: { ltv: 85 },
      });

      expect(result.success).toBe(true);
      expect(result.options![0].adjustments).toHaveLength(1);
      expect(result.options![0].adjustments[0].name).toBe("Large");
    });
  });

  describe("sum-cap", () => {
    it("should scale adjustments when sum exceeds cap", () => {
      const result = runPricingSOPCore({
        ...DEFAULT_INPUT,
        adjustments: [
          { name: "Penalty 1", when: "risk >= 1", priceAdj: -0.5 },
          { name: "Penalty 2", when: "risk >= 1", priceAdj: -0.75 },
        ],
        stackingRules: [
          { type: "sum-cap", members: ["Penalty 1", "Penalty 2"], cap: 1.0 },
        ],
        fieldValues: { risk: 5 },
      });

      expect(result.success).toBe(true);
      const totalPrice = result.options![0].adjustments.reduce(
        (sum, a) => sum + (a.priceAdj ?? 0),
        0
      );
      expect(Math.abs(totalPrice)).toBeCloseTo(1.0, 2);
    });
  });
});

// ============================================================================
// 延期费用
// ============================================================================

describe("extension cost", () => {
  it("should return 0 when no extension days", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [{ days: 7, cost: 0.125, category: "30Yr Fixed" }],
      extensionDays: 0,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBeUndefined();
  });

  it("should return 0 when negative extension days", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [{ days: 7, cost: 0.125, category: "30Yr Fixed" }],
      extensionDays: -5,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBeUndefined();
  });

  it("should return 0 when no extension costs defined", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [],
      extensionDays: 7,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBeUndefined();
  });

  it("should find exact tier match", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [
        { days: 7, cost: 0.125, category: "30Yr Fixed" },
        { days: 15, cost: 0.25, category: "30Yr Fixed" },
      ],
      extensionDays: 7,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBe(0.125);
  });

  it("should find next higher tier when no exact match (5 days -> 7 day tier)", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [
        { days: 7, cost: 0.125, category: "30Yr Fixed" },
        { days: 15, cost: 0.25, category: "30Yr Fixed" },
        { days: 30, cost: 0.5, category: "30Yr Fixed" },
      ],
      extensionDays: 5,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBe(0.125); // 5 天 -> 7 天档
  });

  it("should find next higher tier when between tiers (12 days -> 15 day tier)", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [
        { days: 7, cost: 0.125, category: "30Yr Fixed" },
        { days: 15, cost: 0.25, category: "30Yr Fixed" },
        { days: 30, cost: 0.5, category: "30Yr Fixed" },
      ],
      extensionDays: 12,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBe(0.25); // 12 天 -> 15 天档
  });

  it("should use max tier when extension days exceed all tiers", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [
        { days: 7, cost: 0.125, category: "30Yr Fixed" },
        { days: 15, cost: 0.25, category: "30Yr Fixed" },
        { days: 30, cost: 0.5, category: "30Yr Fixed" },
      ],
      extensionDays: 45, // 超过最大档位 30 天
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBe(0.5); // 使用最大档位
  });

  it("should use 'all' category as fallback when exact category not found", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [
        { days: 10, cost: 0.1, category: "all" },
        { days: 15, cost: 0.25, category: "all" },
      ],
      extensionDays: 5,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBe(0.1); // 5 天 -> 10 天档 (all)
  });

  it("should prefer exact category over 'all' wildcard", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [
        { days: 7, cost: 0.125, category: "30Yr Fixed" }, // 精确匹配
        { days: 7, cost: 0.2, category: "all" }, // 通配符
      ],
      extensionDays: 7,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBe(0.125); // 使用精确匹配
  });

  it("should return 0 when category not found and no 'all' fallback", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      extensionCosts: [
        { days: 7, cost: 0.125, category: "15Yr Fixed" }, // 不匹配
      ],
      extensionDays: 7,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].extensionCost).toBeUndefined(); // 没有匹配的 category
  });
});

// ============================================================================
// 锁定期价格
// ============================================================================

describe("lock day prices", () => {
  it("should apply adjustment for lock days", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      lockDayPrices: {
        "15": { adjustment: 0.125 },
        "30": { adjustment: 0 },
        "45": { adjustment: -0.125 },
      },
      lockDays: 15,
    });

    expect(result.success).toBe(true);
    expect(result.options![0].lockDayAdj).toBe(0.125);
    expect(result.options![0].finalPrice).toBe(100.125);
  });
});

// ============================================================================
// 完整 SOP 流程
// ============================================================================

describe("full SOP flow", () => {
  it("should calculate complete pricing", () => {
    const result = runPricingSOPCore({
      baseRates: [
        { category: "30Yr Fixed", rate: 5.875, price: 100 },
        { category: "30Yr Fixed", rate: 6.0, price: 100.5 },
      ],
      adjustments: [
        { name: "Purchase Bonus", when: 'loanPurpose == "purchase" and ltv <= 80', priceAdj: 0.25 },
        { name: "High FICO", when: "ficoScore >= 760", priceAdj: 0.125, rateAdj: -0.125 },
      ],
      stackingRules: [],
      extensionCosts: [{ days: 7, cost: 0.125, category: "30Yr Fixed" }],
      lockDayPrices: {
        "15": { adjustment: 0.125 },
        "30": { adjustment: 0 },
      },
      fieldValues: { loanPurpose: "purchase", ltv: 75, ficoScore: 780 },
      lockDays: 15,
      extensionDays: 7,
    });

    expect(result.success).toBe(true);
    expect(result.options).toHaveLength(2);

    const option1 = result.options![0];
    expect(option1.adjustments).toHaveLength(2);
    expect(option1.finalRate).toBe(5.75); // 5.875 - 0.125
    // finalPrice = 100 + 0.25 + 0.125 + 0.125 (lockDay) - 0.125 (extension) = 100.375
    expect(option1.finalPrice).toBe(100.375);
  });

  it("should handle empty field values", () => {
    const result = runPricingSOPCore({
      ...DEFAULT_INPUT,
      fieldValues: {},
    });

    expect(result.success).toBe(true);
    expect(result.options![0].adjustments).toHaveLength(0);
  });
});
