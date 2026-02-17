"use client";

/**
 * 定价工具共享渲染器
 *
 * 所有产品定价工具共用的 UI 组件
 */

import { useState, Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CollapsibleSection,
  RateSheetLinks,
  RateSheetPanel,
  ResultSection,
  type RateSheet,
} from "@/components/tool-result";
import type {
  PricingOutput,
  PricingOption,
  TriggeredAdjustment,
} from "@/lib/pricing/output-types";
import { registerToolRenderer } from "./_registry";
import type { ToolRendererProps } from "./_registry";

// loading 状态判断
const LOADING_STATES = new Set(["input-streaming", "input-available"]);

// ============================================================================
// Breakdown Tooltip Component
// ============================================================================

interface BreakdownTooltipProps {
  option: PricingOption;
}

/** Price 计算过程 tooltip */
function PriceBreakdownTooltip({ option }: BreakdownTooltipProps) {
  const adjustments = option.adjustments as TriggeredAdjustment[];
  const priceAdjustments = adjustments.filter((adj) => adj.priceAdj !== undefined && adj.priceAdj !== 0);
  const totalPriceAdj = priceAdjustments.reduce((sum, adj) => sum + (adj.priceAdj ?? 0), 0);

  return (
    <div className="space-y-1.5 py-1">
      {/* 基准价格 */}
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Base</span>
        <span className="font-mono">{option.basePrice.toFixed(3)}</span>
      </div>

      {/* Price 调整项 */}
      {priceAdjustments.length > 0 && (
        <>
          {priceAdjustments.map((adj, idx) => (
            <div key={idx} className="flex justify-between gap-4">
              <span className="text-muted-foreground truncate max-w-[160px]" title={adj.name}>
                {adj.name}
              </span>
              <span className={`font-mono ${(adj.priceAdj ?? 0) < 0 ? "text-red-500" : (adj.priceAdj ?? 0) > 0 ? "text-green-500" : ""}`}>
                {adj.priceAdj! >= 0 ? "+" : ""}{adj.priceAdj!.toFixed(3)}
              </span>
            </div>
          ))}
          {priceAdjustments.length > 1 && (
            <div className="flex justify-between gap-4 text-muted-foreground text-[10px]">
              <span>Subtotal</span>
              <span className={`font-mono ${totalPriceAdj < 0 ? "text-red-500" : totalPriceAdj > 0 ? "text-green-500" : ""}`}>
                {totalPriceAdj >= 0 ? "+" : ""}{totalPriceAdj.toFixed(3)}
              </span>
            </div>
          )}
        </>
      )}

      {/* Lock Day 调整 */}
      {option.lockDayAdj !== undefined && option.lockDayAdj !== 0 && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Lock Adj</span>
          <span className={`font-mono ${option.lockDayAdj < 0 ? "text-red-500" : "text-green-500"}`}>
            {option.lockDayAdj >= 0 ? "+" : ""}{option.lockDayAdj.toFixed(3)}
          </span>
        </div>
      )}

      {/* Extension Cost */}
      {option.extensionCost !== undefined && option.extensionCost !== 0 && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Extension</span>
          <span className="font-mono text-red-500">-{option.extensionCost.toFixed(3)}</span>
        </div>
      )}

      {/* 最终价格 */}
      <div className="border-t my-1" />
      <div className="flex justify-between gap-4 font-medium">
        <span>Final</span>
        <span className="font-mono">{option.finalPrice.toFixed(3)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Spreadsheet Style Table Component
// ============================================================================

function calculatePointRebate(price: number): { point: number; rebate: number } {
  if (price > 100) {
    return { point: 0, rebate: price - 100 };
  } else if (price < 100) {
    return { point: 100 - price, rebate: 0 };
  }
  return { point: 0, rebate: 0 };
}

function formatNumber(value: number, decimals: number = 3): string {
  const formatted = value.toFixed(decimals);
  return formatted.replace(/\.?0+$/, "") || "0";
}

/** Rate 列 hover：展示所有 category 的 rate breakdown（用 Tab 切换） */
interface RateColumnTooltipProps {
  rate: number;
  categories: string[];
  optionsByRate: Record<string, Map<number, PricingOption>>;
}

function RateColumnTooltip({ rate, categories, optionsByRate }: RateColumnTooltipProps) {
  // 收集该 rate 下所有 category 的 option
  const categoryOptions = categories
    .map((cat) => ({ category: cat, option: optionsByRate[cat].get(rate) }))
    .filter((item) => item.option !== undefined) as { category: string; option: PricingOption }[];

  const [activeTab, setActiveTab] = useState(0);

  if (categoryOptions.length === 0) return null;

  const { category, option } = categoryOptions[activeTab] || categoryOptions[0];
  const adjustments = option.adjustments as TriggeredAdjustment[];
  const rateAdjustments = adjustments.filter((adj) => adj.rateAdj !== undefined && adj.rateAdj !== 0);

  return (
    <div className="py-1 min-w-[180px]">
      {/* Tab 切换（多个 category 时显示） */}
      {categoryOptions.length > 1 && (
        <div className="flex gap-1 mb-2 border-b pb-1">
          {categoryOptions.map(({ category: cat }, idx) => (
            <button
              key={cat}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(idx);
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                idx === activeTab
                  ? "bg-white/20 text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 单个 category 时显示标题 */}
      {categoryOptions.length === 1 && (
        <div className="text-[10px] uppercase tracking-wider text-white/60 font-medium mb-1">
          {category}
        </div>
      )}

      {/* Rate breakdown */}
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Base</span>
          <span className="font-mono">{option.baseRate.toFixed(3)}%</span>
        </div>

        {rateAdjustments.length > 0 && (
          <>
            {rateAdjustments.map((adj, idx) => (
              <div key={idx} className="flex justify-between gap-4">
                <span className="text-muted-foreground truncate max-w-[120px]" title={adj.name}>
                  {adj.name}
                </span>
                <span className={`font-mono ${(adj.rateAdj ?? 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                  {adj.rateAdj! >= 0 ? "+" : ""}{adj.rateAdj!.toFixed(3)}%
                </span>
              </div>
            ))}
          </>
        )}

        <div className="border-t my-1" />
        <div className="flex justify-between gap-4 font-medium">
          <span>Final</span>
          <span className="font-mono">{option.finalRate.toFixed(3)}%</span>
        </div>
      </div>
    </div>
  );
}

interface SpreadsheetTableProps {
  productName: string;
  optionsByCategory: Record<string, PricingOption[]>;
  /** 每个 category 默认显示的最大行数，超过则折叠 */
  maxRowsPerCategory?: number;
}

function SpreadsheetTable({ optionsByCategory, maxRowsPerCategory = 10 }: SpreadsheetTableProps) {
  const [showAll, setShowAll] = useState(false);
  const categories = Object.keys(optionsByCategory);

  if (categories.length === 0) {
    return null;
  }

  // 1. 为每个类别获取排序后的 rates，并限制显示行数
  const ratesByCategory: Record<string, number[]> = {};
  let totalHiddenRows = 0;

  for (const cat of categories) {
    const rates = optionsByCategory[cat]
      .map((opt) => opt.finalRate)
      .sort((a, b) => a - b);
    // 去重
    const uniqueRates = [...new Set(rates)];
    ratesByCategory[cat] = uniqueRates;

    if (uniqueRates.length > maxRowsPerCategory) {
      totalHiddenRows += uniqueRates.length - maxRowsPerCategory;
    }
  }

  const needsCollapse = totalHiddenRows > 0;

  // 2. 收集要显示的 Rate 值（每个类别取前 N 个，或全部）
  const displayRatesSet = new Set<number>();
  const displayRatesByCategory: Record<string, Set<number>> = {};

  for (const cat of categories) {
    const rates = ratesByCategory[cat];
    const catDisplayRates = showAll ? rates : rates.slice(0, maxRowsPerCategory);
    displayRatesByCategory[cat] = new Set(catDisplayRates);
    for (const rate of catDisplayRates) {
      displayRatesSet.add(rate);
    }
  }
  const sortedDisplayRates = Array.from(displayRatesSet).sort((a, b) => a - b);

  // 3. 为每个类别创建 Rate -> Option 的映射
  const optionsByRate: Record<string, Map<number, PricingOption>> = {};
  for (const cat of categories) {
    optionsByRate[cat] = new Map();
    for (const opt of optionsByCategory[cat]) {
      optionsByRate[cat].set(opt.finalRate, opt);
    }
  }

  // 共享 Rate 列 + 每个类别 3 列（Price, Point, Rebate）
  return (
    <div className="overflow-x-auto">
      <Table className="border">
        <TableHeader>
          {/* 第一行：类别标题（Rate 列跨两行） */}
          <TableRow className="border-b">
            <TableHead
              rowSpan={2}
              className="text-xs text-center align-middle w-[70px] border-r"
            >
              Rate
            </TableHead>
            {categories.map((cat, idx) => (
              <TableHead
                key={cat}
                colSpan={3}
                className={`text-xs font-medium text-center bg-muted/30 ${
                  idx > 0 ? "border-l" : ""
                }`}
              >
                {cat}
              </TableHead>
            ))}
          </TableRow>
          {/* 第二行：每个类别的 Price/Point/Rebate 列头 */}
          <TableRow>
            {categories.map((cat, idx) => (
              <Fragment key={cat}>
                <TableHead
                  className={`text-xs text-right w-[70px] ${idx > 0 ? "border-l" : ""}`}
                >
                  Price
                </TableHead>
                <TableHead className="text-xs text-right w-[60px]">
                  Point
                </TableHead>
                <TableHead className="text-xs text-right w-[60px]">
                  Rebate
                </TableHead>
              </Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDisplayRates.map((rate) => {
            // 检查是否有任何 category 的 option 有 rateAdj（仅考虑显示范围内的）
            const hasAnyRateAdj = categories.some((cat) => {
              if (!displayRatesByCategory[cat].has(rate)) return false;
              const opt = optionsByRate[cat].get(rate);
              if (!opt) return false;
              const adjs = opt.adjustments as TriggeredAdjustment[];
              return adjs.some((adj) => adj.rateAdj !== undefined && adj.rateAdj !== 0);
            });

            return (
            <TableRow key={rate}>
              {/* 共享的 Rate 列 */}
              <TableCell className="text-xs text-center align-middle font-mono border-r">
                {hasAnyRateAdj ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="border-b border-dashed border-muted-foreground/50 cursor-help">
                        {rate.toFixed(3)}%
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs max-w-[280px]">
                      <RateColumnTooltip
                        rate={rate}
                        categories={categories}
                        optionsByRate={optionsByRate}
                      />
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <>{rate.toFixed(3)}%</>
                )}
              </TableCell>
              {/* 每个类别的 Price/Point/Rebate */}
              {categories.map((cat, idx) => {
                const option = optionsByRate[cat].get(rate);
                // 检查：1) 该类别有此 rate 的数据，2) 此 rate 在该类别的显示范围内
                const isInDisplayRange = displayRatesByCategory[cat].has(rate);
                if (!option || !isInDisplayRange) {
                  // 该类别在此 Rate 下没有数据或超出显示范围，显示空单元格
                  return (
                    <Fragment key={cat}>
                      <TableCell
                        className={`text-xs ${idx > 0 ? "border-l" : ""}`}
                      />
                      <TableCell className="text-xs" />
                      <TableCell className="text-xs" />
                    </Fragment>
                  );
                }

                const { point, rebate } = calculatePointRebate(option.finalPrice);
                const adjustments = option.adjustments as TriggeredAdjustment[];
                // 只有 priceAdj 时才显示 hover（rateAdj 在 Rate 列显示）
                const hasPriceAdj = adjustments.some((adj) => adj.priceAdj !== undefined && adj.priceAdj !== 0);
                const hasBreakdown = hasPriceAdj || (option.lockDayAdj !== undefined && option.lockDayAdj !== 0) || (option.extensionCost !== undefined && option.extensionCost !== 0);

                return (
                  <Fragment key={cat}>
                    <TableCell
                      className={`text-xs text-right font-mono ${idx > 0 ? "border-l" : ""}`}
                    >
                      {hasBreakdown ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="border-b border-dashed border-muted-foreground/50 cursor-help">
                              {option.finalPrice.toFixed(3)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[280px]">
                            <PriceBreakdownTooltip option={option} />
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        option.finalPrice.toFixed(3)
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {point > 0 ? formatNumber(point) : "0"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {rebate > 0 ? formatNumber(rebate) : "0"}
                    </TableCell>
                  </Fragment>
                );
              })}
            </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* 展开/收起按钮 */}
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t flex items-center justify-center gap-1"
        >
          {showAll ? (
            <>
              <ChevronRight className="h-3 w-3 -rotate-90" />
              Show fewer rates
            </>
          ) : (
            <>
              <ChevronRight className="h-3 w-3 rotate-90" />
              Show {totalHiddenRows} more rate{totalHiddenRows > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Result Component
// ============================================================================

export interface PricingSOPResultUIProps {
  result?: PricingOutput | null;
  args?: Record<string, unknown>;
  state?: string;
}

export function PricingSOPResultUI({ result, args, state }: PricingSOPResultUIProps) {
  const [selectedSheet, setSelectedSheet] = useState<RateSheet | null>(null);

  const rateSheets = (result?.rateSheets as RateSheet[] | undefined) || [];

  const isLoading = !state || LOADING_STATES.has(state);

  if (isLoading || !result) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Spinner className="h-3 w-3" />
        <span>Calculating pricing...</span>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="text-xs text-muted-foreground">
        Pricing Error: {result.error || "Unknown error"}
      </div>
    );
  }

  const options = (result.options ?? []) as PricingOption[];

  if (options.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Pricing: No options available
      </div>
    );
  }

  const productName = result.productName || "Options";

  const optionsByCategory = options.reduce<Record<string, PricingOption[]>>((acc, opt) => {
    const cat = opt.category || productName;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(opt);
    return acc;
  }, {});


  const skippedAdjustments = result.skippedAdjustments;

  return (
    <div>
      <div className="border rounded-lg overflow-hidden divide-y">
        {/* 标题 + Rate Sheet 链接 */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="text-sm font-semibold text-foreground">{productName} Pricing</div>
          {rateSheets.length > 0 && (
            <RateSheetLinks rateSheets={rateSheets} onSelect={setSelectedSheet} />
          )}
        </div>

        {/* 主表格：电子表格风格 */}
        <ResultSection>
          <SpreadsheetTable
            productName={productName}
            optionsByCategory={optionsByCategory}
          />
        </ResultSection>

        {/* 跳过的调整项提示 */}
        {skippedAdjustments && skippedAdjustments.length > 0 && (
          <div className="px-3 py-2">
            <div className="text-[10px] text-muted-foreground/70">
              {skippedAdjustments.length} adjustment(s) skipped due to missing fields
            </div>
          </div>
        )}

        {/* 原始 JSON（调试用，仅开发环境显示） */}
        {process.env.NODE_ENV === "development" && <CollapsibleSection title="JSON" defaultOpen={false} borderless>
          <div className="space-y-2 px-3 py-2">
            {args && (
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1">Input</div>
                <pre className="text-[10px] leading-tight text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1">Output</div>
              <pre className="text-[10px] leading-tight text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(result, (k, v) => k === "_uiRendered" || k === "_message" ? undefined : v, 2)}
              </pre>
            </div>
          </div>
        </CollapsibleSection>}
      </div>

      {/* Rate Sheet Viewer */}
      <RateSheetPanel
        selectedSheet={selectedSheet}
        onClose={() => setSelectedSheet(null)}
      />
    </div>
  );
}

// ============================================================================
// Tool Renderer Registration
// ============================================================================

function PricingResultRenderer({ input, output, state }: ToolRendererProps) {
  return (
    <PricingSOPResultUI
      result={output as PricingSOPResultUIProps["result"]}
      args={input as Record<string, unknown>}
      state={state}
    />
  );
}

registerToolRenderer("pricing-result", PricingResultRenderer);
