"use client";

/**
 * 可折叠区域
 *
 * 通用折叠/展开组件，
 * 支持有边框（独立使用）和无边框（嵌入 divide-y 卡片）两种模式
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
  borderless?: boolean;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  badge,
  borderless = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={borderless ? "" : "border rounded-lg overflow-hidden"}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center gap-2 transition-colors text-left ${
          borderless
            ? "px-3 py-1.5 hover:bg-muted/30"
            : "px-3 py-2 bg-muted/30 hover:bg-muted/50"
        }`}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
        <span className="text-xs font-medium flex-1">{title}</span>
        {badge !== undefined && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </button>
      {isOpen && (
        <div className={borderless ? "pt-1" : "border-t"}>{children}</div>
      )}
    </div>
  );
}
