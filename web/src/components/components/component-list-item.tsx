"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ComponentRow } from "@/db/schema";

interface ComponentListItemProps {
  component: ComponentRow;
  isActive: boolean;
  onSelect: (id: string) => void;
  usedByCount?: number;
}

export function ComponentListItem({
  component,
  isActive,
  onSelect,
  usedByCount = 0,
}: ComponentListItemProps) {
  const handleSelect = useCallback(() => {
    onSelect(component.id);
  }, [component.id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isActive && "bg-muted font-medium"
      )}
      onClick={handleSelect}
    >
      <span className="min-w-0 flex-1 truncate">{component.name}</span>
      <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
        {component.key}
      </span>
      {usedByCount > 0 && (
        <span className="shrink-0 text-[10px] text-muted-foreground" title={`被 ${usedByCount} 个组件引用`}>
          ×{usedByCount}
        </span>
      )}
    </button>
  );
}
