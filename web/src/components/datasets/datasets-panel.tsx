"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function DatasetsPanel({ agentId }: { agentId: string }) {
  const { datasets, mutate: mutateList } = useDatasets(agentId);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { dataset: activeDataset, mutate: mutateDetail } =
    useDataset(activeDatasetId);

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
        { key, name, description: "", data: {}, agentId },
        mutateList
      );
      if (result?.id) {
        setActiveDatasetId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [mutateList, agentId]
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
    <div className="flex h-full flex-col">
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

      <DatasetCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWithKey}
      />
    </div>
  );
}
