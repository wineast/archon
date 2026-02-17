"use client";

/**
 * 输入参数展示区域
 *
 * 折叠式参数网格，字段名带 tooltip 显示描述，
 * 定价和核保渲染器共用
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { CollapsibleSection } from "./collapsible-section";

interface InputsSectionProps {
  /** 折叠标题 */
  title?: string;
  /** 输入参数 */
  args: Record<string, unknown>;
  /** 字段描述映射（fieldName → description），hover 展示 */
  fieldDescriptions?: Record<string, string>;
  /** 从主网格中排除的 key（由调用者单独渲染） */
  excludeKeys?: Set<string>;
  /** 渲染在字段网格上方的自定义内容（如引擎参数） */
  headerContent?: React.ReactNode;
}

export function InputsSection({
  title = "Parameters",
  args,
  fieldDescriptions,
  excludeKeys,
  headerContent,
}: InputsSectionProps) {
  const fieldEntries = Object.entries(args).filter(
    ([key, v]) =>
      v !== undefined && v !== "" && (!excludeKeys || !excludeKeys.has(key))
  );
  const hasFieldValues = fieldEntries.length > 0;

  if (!headerContent && !hasFieldValues) return null;

  return (
    <CollapsibleSection title={title} defaultOpen borderless>
      <div className="px-3 pb-3 space-y-3 text-xs">
        {headerContent}
        {headerContent && hasFieldValues && <div className="border-t" />}
        {hasFieldValues && (
          <TooltipProvider>
            <div className="grid grid-cols-2 gap-2">
              {fieldEntries.map(([key, value]) => {
                const desc = fieldDescriptions?.[key];
                return (
                  <div key={key} className="flex justify-between gap-2">
                    {desc ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground border-b border-dashed border-muted-foreground/50 cursor-help">
                            {key}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-sm">
                          {desc}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">{key}</span>
                    )}
                    <span className="font-mono">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </div>
    </CollapsibleSection>
  );
}
