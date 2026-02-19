"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchemaRow } from "@/db/schema";

interface SchemaListItemProps {
  schema: SchemaRow;
  isActive: boolean;
  onSelect: (id: string) => void;
}

export function SchemaListItem({
  schema,
  isActive,
  onSelect,
}: SchemaListItemProps) {
  const handleSelect = useCallback(() => {
    onSelect(schema.id);
  }, [schema.id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isActive && "bg-muted font-medium"
      )}
      onClick={handleSelect}
    >
      <span className="min-w-0 flex-1 truncate">{schema.name}</span>
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        {schema.parameters.length}p
      </Badge>
    </button>
  );
}
