"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import datasetsGuide from "../../../guide/datasets.md";
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
  const t = useTranslations("build");
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("datasets")}</span>
          <GuideDialog title="数据集模块" content={datasetsGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title={t("newDataset")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {datasets.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noDatasets")}
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
