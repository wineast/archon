"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, GlobeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import datasetsGuide from "../../../guide/datasets.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DatasetRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";

interface DatasetsSidebarProps {
  datasets: WithPoolMeta<DatasetRow>[];
  activeDatasetId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onAddFromPool?: () => void;
  onRemoveRef?: (refId: string) => void;
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
  onAddFromPool,
  onRemoveRef,
}: DatasetsSidebarProps) {
  const t = useTranslations("build");
  const ta = useTranslations("admin");

  const privateDatasets = datasets.filter((d) => d._source === "private");
  const poolDatasets = datasets.filter((d) => d._source === "pool");

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
          {privateDatasets.length === 0 && poolDatasets.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noDatasets")}
            </p>
          ) : (
            <>
              {privateDatasets.map((ds) => (
                <DatasetListItem
                  key={ds.id}
                  dataset={ds}
                  isActive={activeDatasetId === ds.id}
                  onSelect={onSelect}
                />
              ))}

              {poolDatasets.length > 0 && (
                <>
                  <div className="mt-2 mb-1 px-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ta("poolRefs")}
                    </span>
                  </div>
                  {poolDatasets.map((ds) => (
                    <div key={ds.id} className="group flex items-center">
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                          activeDatasetId === ds.id && "bg-muted font-medium"
                        )}
                        onClick={() => onSelect(ds.id)}
                      >
                        <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-left">{ds.name}</span>
                      </button>
                      {ds._refId && onRemoveRef && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="mr-1 opacity-0 group-hover:opacity-100"
                          onClick={() => onRemoveRef(ds._refId!)}
                          title={ta("removeRef")}
                        >
                          <XIcon className="size-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      {onAddFromPool && (
        <div className="border-t px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onAddFromPool}
          >
            <GlobeIcon className="mr-1 size-3" />
            {ta("addFromPool")}
          </Button>
        </div>
      )}
    </div>
  );
}
