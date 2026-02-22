"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useDatasets,
  createDataset,
  updateDataset,
  deleteDataset,
} from "@/lib/datasets/hooks";
import { removeAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import { DatasetsSidebar } from "./datasets-sidebar";
import { DatasetDetail } from "./dataset-detail";
import { DatasetsEmptyState } from "./datasets-empty-state";
import { DatasetCreateDialog } from "./dataset-create-dialog";
import { AddFromPoolDialog } from "@/components/pool/add-from-pool-dialog";
import { toPoolMeta } from "@/components/pool/types";

export function DatasetsPanel({ agentId }: { agentId: string }) {
  const { datasets, mutate: mutateList } = useDatasets(agentId);
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) ?? null,
    [datasets, activeDatasetId]
  );

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
      await updateDataset(id, data, mutateList);
    },
    [mutateList]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDataset(id, mutateList);
      if (activeDatasetId === id) setActiveDatasetId(null);
    },
    [mutateList, activeDatasetId]
  );

  const handleRemoveRef = useCallback(
    async (refId: string) => {
      try {
        await removeAgentRef(agentId, refId, mutateRefs);
        await mutateList();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove ref");
      }
    },
    [agentId, mutateRefs, mutateList],
  );

  const handlePoolAdded = useCallback(() => {
    mutateList();
  }, [mutateList]);

  return (
    <div className="flex h-full flex-col">
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <DatasetsSidebar
          datasets={datasets}
          activeDatasetId={activeDatasetId}
          onSelect={setActiveDatasetId}
          onCreate={openCreateDialog}
          onAddFromPool={() => setPoolDialogOpen(true)}
          onRemoveRef={handleRemoveRef}
        />
        <div className="flex-1 overflow-hidden">
          {activeDataset ? (
            <DatasetDetail
              key={activeDataset.id}
              dataset={activeDataset}
              agentId={agentId}
              onSave={handleSave}
              onDelete={handleDelete}
              poolMeta={toPoolMeta(activeDataset)}
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
                agentId={agentId}
                onSave={handleSave}
                onDelete={handleDelete}
                poolMeta={toPoolMeta(activeDataset)}
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
      <AddFromPoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        resourceType="dataset"
        agentId={agentId}
        onAdded={handlePoolAdded}
      />
    </div>
  );
}
