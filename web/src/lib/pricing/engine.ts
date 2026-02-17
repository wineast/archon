/**
 * 定价核心计算引擎
 *
 * 供所有产品工具共用
 */

import { compileExpression } from "filtrex";
import type {
  BaseRate,
  Adjustment,
  StackingRule,
  ExtensionCost,
  LockDayPrice,
  LLPAMatrix,
  ProductPricingConfig,
} from "./types";
import {
  ENGINE_DEFAULTS,
  type PricingOption,
  type PricingOutput,
  type TriggeredAdjustment,
  type SkippedAdjustment,
} from "./output-types";

// ============================================================================
// 字段提取与跳过逻辑
// ============================================================================

// filtrex 关键字，不是字段名
const FILTREX_KEYWORDS = new Set([
  "and", "or", "not", "in", "if", "then", "else",
  "true", "false", "null", "undefined",
]);

/**
 * 从 when 表达式中提取字段名
 *
 * 例如：
 * - "ficoScore < 700" → ["ficoScore"]
 * - "ltv > 80 and loanPurpose == \"cashOut\"" → ["ltv", "loanPurpose"]
 */
export function extractFieldsFromExpression(when: string): string[] {
  // 先移除字符串字面量，避免把字符串内容当成字段名
  const withoutStrings = when.replace(/"[^"]*"|'[^']*'/g, '""');

  // 匹配标识符
  const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  const matches = withoutStrings.match(identifierRegex) || [];

  // 过滤掉关键字，去重
  const fields = [...new Set(matches.filter((m) => !FILTREX_KEYWORDS.has(m.toLowerCase())))];
  return fields;
}

/**
 * 检查调整项的 when 表达式是否引用了未提供的字段
 * 缺失字段时返回 skip: true
 */
function shouldSkipAdjustment(
  when: string,
  fieldValues: Record<string, unknown>
): { skip: boolean; missingFields: string[] } {
  const fields = extractFieldsFromExpression(when);
  const provided = new Set(Object.keys(fieldValues));
  const missing = fields.filter((f) => !provided.has(f));
  return { skip: missing.length > 0, missingFields: missing };
}

// ============================================================================
// 表达式评估器
// ============================================================================

/**
 * 编译并执行表达式
 */
function evaluateExpression(
  when: string,
  fieldValues: Record<string, unknown>
): boolean {
  try {
    const filter = compileExpression(when);
    const result = filter(fieldValues as Record<string, unknown>);
    return Boolean(result);
  } catch {
    return false;
  }
}

// ============================================================================
// LLPA 矩阵查表
// ============================================================================

/**
 * 从 LLPA 矩阵中查找调整值
 *
 * 遍历所有矩阵，检查前置条件是否满足，然后根据 FICO 和 LTV 查表
 */
function lookupLLPAMatrices(
  matrices: readonly LLPAMatrix[],
  fieldValues: Record<string, unknown>
): TriggeredAdjustment[] {
  const triggered: TriggeredAdjustment[] = [];

  for (const matrix of matrices) {
    // 1. 检查前置条件
    if (!evaluateExpression(matrix.when, fieldValues)) continue;

    // 2. 获取 FICO 和 LTV
    const fico = fieldValues.ficoScore as number | undefined;
    const ltv = fieldValues.ltv as number | undefined;
    if (fico === undefined || ltv === undefined) continue;

    // 3. 查表：找到匹配的 FICO 和 LTV 范围
    const ficoIdx = matrix.ficoRanges.findIndex(
      (r) => fico >= r.min && fico <= r.max
    );
    const ltvIdx = matrix.ltvRanges.findIndex(
      (r) => ltv >= r.min && ltv <= r.max
    );
    if (ficoIdx === -1 || ltvIdx === -1) continue;

    const value = matrix.values[ficoIdx]?.[ltvIdx];
    // null = N/A，0 = 无调整，跳过
    if (value === null || value === undefined || value === 0) continue;

    // 4. 生成调整项
    const ficoLabel = matrix.ficoRanges[ficoIdx].label;
    const ltvLabel = matrix.ltvRanges[ltvIdx].label;

    triggered.push({
      name: `${matrix.name}: FICO ${ficoLabel}, LTV ${ltvLabel}`,
      // fee/price: 表格正值 = 收费/减价 = 负的 priceAdj
      // rate: 表格正值 = 加息 = 正的 rateAdj
      ...(matrix.adjustmentType === "fee" || matrix.adjustmentType === "price"
        ? { priceAdj: -value }
        : { rateAdj: value }),
      citations: [matrix.citation],
    });
  }

  return triggered;
}

// ============================================================================
// SOP 实现
// ============================================================================

/** 评估调整项（带 category 过滤 + 跳过缺失字段） */
function evaluateAdjustments(
  adjustments: readonly Adjustment[],
  fieldValues: Record<string, unknown>,
  category: string
): { triggered: TriggeredAdjustment[]; skipped: SkippedAdjustment[] } {
  const triggered: TriggeredAdjustment[] = [];
  const skipped: SkippedAdjustment[] = [];

  for (const adj of adjustments) {
    // 检查 appliesTo 过滤
    if (adj.appliesTo && adj.appliesTo.length > 0 && !adj.appliesTo.includes(category)) {
      continue;
    }

    // 检查缺失字段 → 跳过
    const { skip, missingFields } = shouldSkipAdjustment(adj.when, fieldValues);
    if (skip) {
      skipped.push({
        name: adj.name,
        reason: "missing_field",
        missingFields,
        expression: adj.when,
        priceAdj: adj.priceAdj,
        rateAdj: adj.rateAdj,
      });
      continue;
    }

    // 评估 when 表达式
    if (evaluateExpression(adj.when, fieldValues)) {
      triggered.push({
        name: adj.name,
        expression: adj.when,
        priceAdj: adj.priceAdj,
        rateAdj: adj.rateAdj,
        citations: adj.citations,
      });
    }
  }

  return { triggered, skipped };
}

/** 应用叠加规则 */
function applyStackingRules(
  triggered: TriggeredAdjustment[],
  stackingRules: readonly StackingRule[]
): TriggeredAdjustment[] {
  let result = [...triggered];

  for (const rule of stackingRules) {
    const memberSet = new Set(rule.members);
    const inGroup = result.filter((t) => memberSet.has(t.name));
    const notInGroup = result.filter((t) => !memberSet.has(t.name));

    if (inGroup.length === 0) continue;

    // 按 members 数组顺序排序
    const orderedGroup = [...inGroup].sort((a, b) => {
      const aIdx = rule.members.indexOf(a.name);
      const bIdx = rule.members.indexOf(b.name);
      return aIdx - bIdx;
    });

    switch (rule.type) {
      case "mutex":
        result = [...notInGroup, orderedGroup[0]];
        break;

      case "max-one": {
        const maxEffect = orderedGroup.reduce((max, curr) => {
          const maxVal = Math.abs(max.rateAdj ?? 0) + Math.abs(max.priceAdj ?? 0);
          const currVal = Math.abs(curr.rateAdj ?? 0) + Math.abs(curr.priceAdj ?? 0);
          return currVal > maxVal ? curr : max;
        });
        result = [...notInGroup, maxEffect];
        break;
      }

      case "sum-cap": {
        if (rule.cap === undefined) break;
        const totalRate = inGroup.reduce((sum, t) => sum + (t.rateAdj ?? 0), 0);
        const totalPrice = inGroup.reduce((sum, t) => sum + (t.priceAdj ?? 0), 0);

        if (Math.abs(totalRate) <= rule.cap && Math.abs(totalPrice) <= rule.cap) {
          break;
        }

        const rateScale = Math.abs(totalRate) > rule.cap ? rule.cap / Math.abs(totalRate) : 1;
        const priceScale = Math.abs(totalPrice) > rule.cap ? rule.cap / Math.abs(totalPrice) : 1;

        const scaled = inGroup.map((t) => ({
          ...t,
          rateAdj: t.rateAdj !== undefined ? t.rateAdj * rateScale : undefined,
          priceAdj: t.priceAdj !== undefined ? t.priceAdj * priceScale : undefined,
        }));
        result = [...notInGroup, ...scaled];
        break;
      }
    }
  }

  return result;
}

/** 计算延期费用 */
function calculateExtensionCost(
  extensionCosts: readonly ExtensionCost[],
  extensionDays: number,
  category: string
): number {
  if (extensionDays <= 0 || extensionCosts.length === 0) return 0;

  // 先尝试精确匹配 category
  let categoryCosts = extensionCosts.filter((c) => c.category === category);

  // 如果没有精确匹配，使用 "all" 通配符
  if (categoryCosts.length === 0) {
    categoryCosts = extensionCosts.filter((c) => c.category === "all");
  }

  if (categoryCosts.length === 0) return 0;

  // 按天数升序排序
  const sorted = [...categoryCosts].sort((a, b) => a.days - b.days);

  // 找到 >= extensionDays 的最小档位
  const tier = sorted.find((c) => c.days >= extensionDays);
  if (tier) return tier.cost;

  // 如果延期天数超过所有档位，使用最大档位
  return sorted[sorted.length - 1].cost;
}

/** 获取锁定期价格调整 */
function getLockDayAdjustment(
  lockDayPrices: Record<string, LockDayPrice> | undefined,
  lockDays: number,
  category: string
): number {
  if (!lockDayPrices) return 0;

  const config = lockDayPrices[String(lockDays)];
  if (!config) return 0;

  if (config.appliesTo && config.appliesTo.length > 0 && !config.appliesTo.includes(category)) {
    return 0;
  }

  return config.adjustment;
}

/** 计算单个定价选项 */
function calculateOption(
  baseRate: BaseRate,
  adjustments: TriggeredAdjustment[],
  extensionCosts: readonly ExtensionCost[],
  lockDayPrices: Record<string, LockDayPrice> | undefined,
  params: {
    extensionDays: number;
    lockDays: number;
  }
): PricingOption {
  const category = baseRate.category;

  let rateAdj = 0;
  let priceAdj = 0;
  for (const adj of adjustments) {
    rateAdj += adj.rateAdj ?? 0;
    priceAdj += adj.priceAdj ?? 0;
  }

  const finalRate = baseRate.rate + rateAdj;
  const lockDayAdj = getLockDayAdjustment(lockDayPrices, params.lockDays, category);
  const extensionCost = calculateExtensionCost(extensionCosts, params.extensionDays, category);
  const finalPrice = baseRate.price + priceAdj + lockDayAdj - extensionCost;

  return {
    category,
    baseRate: baseRate.rate,
    basePrice: baseRate.price,
    finalRate: Math.round(finalRate * 1000) / 1000,
    finalPrice: Math.round(finalPrice * 1000) / 1000,
    adjustments,
    lockDayAdj: lockDayAdj !== 0 ? Math.round(lockDayAdj * 1000) / 1000 : undefined,
    extensionCost: extensionCost !== 0 ? Math.round(extensionCost * 1000) / 1000 : undefined,
  };
}

// ============================================================================
// 核心函数
// ============================================================================

export interface SOPResult {
  success: boolean;
  options?: PricingOption[];
  skippedAdjustments?: SkippedAdjustment[];
  error?: string;
}

export interface SOPCoreInput {
  baseRates: readonly BaseRate[];
  adjustments?: readonly Adjustment[];
  llpaMatrices?: readonly LLPAMatrix[];
  stackingRules?: readonly StackingRule[];
  extensionCosts?: readonly ExtensionCost[];
  lockDayPrices?: Record<string, LockDayPrice>;
  fieldValues: Record<string, unknown>;
  lockDays?: number;
  extensionDays?: number;
}

/**
 * 执行定价 SOP 核心逻辑
 * 缺失字段时跳过引用该字段的调整项，不报错
 */
export function runPricingSOPCore(input: SOPCoreInput): SOPResult {
  try {
    const {
      baseRates,
      adjustments = [],
      llpaMatrices = [],
      stackingRules = [],
      extensionCosts = [],
      lockDayPrices,
      fieldValues,
      lockDays = ENGINE_DEFAULTS.lockDays,
      extensionDays = ENGINE_DEFAULTS.extensionDays,
    } = input;

    const options: PricingOption[] = [];
    // 使用 Map 聚合跳过的调整项，保存完整信息
    const skippedMap = new Map<string, SkippedAdjustment>();

    // 预先计算 LLPA 矩阵调整（所有 category 共用）
    const matrixTriggered = lookupLLPAMatrices(llpaMatrices, fieldValues);

    for (const baseRate of baseRates) {
      // 检查基准利率的展示条件（如有）
      // 缺失字段时不跳过（默认展示），仅在字段齐全且条件不满足时才跳过
      if (baseRate.when) {
        const { skip } = shouldSkipAdjustment(baseRate.when, fieldValues);
        if (!skip && !evaluateExpression(baseRate.when, fieldValues)) continue;
      }

      const category = baseRate.category;

      // 1. 评估传统调整项（缺失字段自动跳过）
      const { triggered, skipped } = evaluateAdjustments(adjustments, fieldValues, category);

      // 聚合跳过的调整项
      for (const s of skipped) {
        const existing = skippedMap.get(s.name);
        if (existing) {
          // 合并 missingFields
          for (const f of s.missingFields) {
            if (!existing.missingFields.includes(f)) {
              existing.missingFields.push(f);
            }
          }
        } else {
          // 复制对象，避免 mutate 原数组元素
          skippedMap.set(s.name, { ...s, missingFields: [...s.missingFields] });
        }
      }

      // 2. 合并传统调整项和矩阵调整项
      const allTriggered = [...triggered, ...matrixTriggered];

      // 3. 应用叠加规则
      const filtered = applyStackingRules(allTriggered, stackingRules);

      // 4. 计算定价
      const option = calculateOption(baseRate, filtered, extensionCosts, lockDayPrices, {
        extensionDays,
        lockDays,
      });

      options.push(option);
    }

    // 转换为数组格式
    const skippedArray: SkippedAdjustment[] = [...skippedMap.values()];

    return {
      success: true,
      options,
      skippedAdjustments: skippedArray.length > 0 ? skippedArray : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建产品定价工具的 execute 函数
 *
 * 所有产品工具共用的逻辑：
 * 1. 从扁平输入参数中提取 fieldValues
 * 2. 调用核心引擎计算
 * 3. 返回标准化输出
 */
export function createPricingExecute(
  config: ProductPricingConfig,
  fieldKeys: readonly string[],
) {
  return async (params: Record<string, unknown>): Promise<PricingOutput> => {
    // 从扁平参数中提取 fieldValues
    const fieldValues: Record<string, unknown> = {};
    for (const key of fieldKeys) {
      if (key in params && params[key] !== undefined) {
        fieldValues[key] = params[key];
      }
    }

    const lockDays = (params.lockDays as number | undefined) ?? ENGINE_DEFAULTS.lockDays;
    const extensionDays = (params.extensionDays as number | undefined) ?? ENGINE_DEFAULTS.extensionDays;

    const coreInput: SOPCoreInput = {
      baseRates: config.baseRates,
      adjustments: config.adjustments,
      llpaMatrices: config.llpaMatrices,
      stackingRules: config.stackingRules,
      extensionCosts: config.extensionCosts,
      fieldValues,
      lockDays,
      extensionDays,
    };

    const result = runPricingSOPCore(coreInput);

    const productName = config.productName;
    const rateSheets = [...config.rateSheets];

    const options = result.options ?? [];
    const bestOption = options.length > 0
      ? options.reduce((min, opt) => (opt.finalRate < min.finalRate ? opt : min))
      : null;

    const message = result.success
      ? options.length > 0
        ? `${productName}: ${options.length} options. Best rate: ${bestOption!.finalRate.toFixed(3)}%`
        : `${productName}: No options available`
      : `${productName} Error: ${result.error}`;

    return {
      success: result.success,
      productName,
      options: result.options,
      error: result.error,
      rateSheets,
      skippedAdjustments: result.skippedAdjustments,
      _uiRendered: true,
      _message: message,
    };
  };
}
