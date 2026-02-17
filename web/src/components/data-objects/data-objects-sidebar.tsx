"use client";

import { useCallback } from "react";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DataObjectRow } from "@/db/schema";

interface DataObjectsSidebarProps {
  objects: DataObjectRow[];
  activeObjectId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

function ObjectListItem({
  object,
  isActive,
  onSelect,
}: {
  object: DataObjectRow;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const handleSelect = useCallback(() => {
    onSelect(object.id);
  }, [object.id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isActive && "bg-muted font-medium"
      )}
      onClick={handleSelect}
    >
      <span className="min-w-0 flex-1 truncate">{object.name}</span>
      <Badge variant="secondary" className="shrink-0 text-[10px] font-mono">
        {object.key}
      </Badge>
    </button>
  );
}

export function DataObjectsSidebar({
  objects,
  activeObjectId,
  onSelect,
  onCreate,
}: DataObjectsSidebarProps) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Data Objects</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Object"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {objects.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No data objects yet
            </p>
          ) : (
            objects.map((obj) => (
              <ObjectListItem
                key={obj.id}
                object={obj}
                isActive={activeObjectId === obj.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
