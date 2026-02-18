"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useDatasets,
  useDataset,
  createDataset,
  updateDataset,
  deleteDataset,
} from "@/lib/datasets/hooks";
import { DatasetsSidebar } from "./datasets-sidebar";
import { DatasetDetail } from "./dataset-detail";
import { DatasetsEmptyState } from "./datasets-empty-state";
import { DatasetCreateDialog } from "./dataset-create-dialog";

export function DatasetsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { datasets, mutate: mutateList } = useDatasets();
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { dataset: activeDataset, mutate: mutateDetail } =
    useDataset(open ? activeDatasetId : null);

  useEffect(() => {
    if (activeDatasetId) {
      setMobileView("detail");
    }
  }, [activeDatasetId]);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateWithKey = useCallback(
    async (key: string, name: string) => {
      const result = await createDataset(
        { key, name, description: "", data: {} },
        mutateList
      );
      if (result?.id) {
        setActiveDatasetId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [mutateList]
  );

  const handleSave = useCallback(
    async (
      id: string,
      data: { name: string; description: string; data: unknown }
    ) => {
      await updateDataset(id, data, () => {
        mutateList();
        mutateDetail();
      });
    },
    [mutateList, mutateDetail]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDataset(id, mutateList);
      if (activeDatasetId === id) setActiveDatasetId(null);
    },
    [mutateList, activeDatasetId]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Datasets</SheetTitle>
        <SheetDescription className="sr-only">
          Manage dataset entries
        </SheetDescription>

        {/* Desktop layout */}
        <div className="hidden h-full sm:flex">
          <DatasetsSidebar
            datasets={datasets}
            activeDatasetId={activeDatasetId}
            onSelect={setActiveDatasetId}
            onCreate={openCreateDialog}
          />
          <div className="flex-1 overflow-hidden">
            {activeDataset ? (
              <DatasetDetail
                key={activeDataset.id}
                dataset={activeDataset}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ) : (
              <DatasetsEmptyState onCreate={openCreateDialog} />
            )}
          </div>
        </div>

        {/* Mobile layout */}
        <div className="flex h-full flex-col sm:hidden">
          {mobileView === "sidebar" || !activeDataset ? (
            <DatasetsSidebar
              datasets={datasets}
              activeDatasetId={activeDatasetId}
              onSelect={setActiveDatasetId}
              onCreate={openCreateDialog}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setMobileView("sidebar")}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <span className="text-sm font-medium">Back</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <DatasetDetail
                  key={activeDataset.id}
                  dataset={activeDataset}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>

      <DatasetCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWithKey}
      />
    </Sheet>
  );
}
