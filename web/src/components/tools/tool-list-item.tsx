"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolRow } from "@/db/schema";

interface ToolListItemProps {
  tool: ToolRow;
  isActive: boolean;
  onSelect: (id: string) => void;
}

export function ToolListItem({
  tool,
  isActive,
  onSelect,
}: ToolListItemProps) {
  const handleSelect = useCallback(() => {
    onSelect(tool.id);
  }, [tool.id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isActive && "bg-muted font-medium",
        !tool.enabled && "text-muted-foreground"
      )}
      onClick={handleSelect}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tool.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{tool.name}</span>
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        {tool.parameters.length}p
      </Badge>
    </button>
  );
}
