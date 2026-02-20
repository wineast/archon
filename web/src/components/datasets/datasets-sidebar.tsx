"use client";

import { useCallback } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DatasetRow } from "@/db/schema";

interface DatasetsSidebarProps {
  datasets: DatasetRow[];
  activeDatasetId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

function DatasetListItem({
  dataset,
  isActive,
  onSelect,
}: {
  dataset: DatasetRow;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const handleSelect = useCallback(() => {
    onSelect(dataset.id);
  }, [dataset.id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isActive && "bg-muted font-medium"
      )}
      onClick={handleSelect}
    >
      <span className="min-w-0 flex-1 truncate">{dataset.name}</span>
    </button>
  );
}

export function DatasetsSidebar({
  datasets,
  activeDatasetId,
  onSelect,
  onCreate,
}: DatasetsSidebarProps) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Datasets</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Dataset"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {datasets.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No datasets yet
            </p>
          ) : (
            datasets.map((ds) => (
              <DatasetListItem
                key={ds.id}
                dataset={ds}
                isActive={activeDatasetId === ds.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
