"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { JudgeConfigRow } from "@/db/schema";

interface JudgeConfigListItemProps {
  config: JudgeConfigRow;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function JudgeConfigListItem({
  config,
  isSelected,
  onSelect,
}: JudgeConfigListItemProps) {
  const handleSelect = useCallback(() => {
    onSelect(config.id);
  }, [config.id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isSelected && "bg-muted font-medium"
      )}
      onClick={handleSelect}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          config.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{config.name}</span>
    </button>
  );
}
