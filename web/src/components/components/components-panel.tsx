"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  componentsApiKey,
  createComponent,
  updateComponent,
  deleteComponent,
} from "@/lib/components/hooks";
import { removeAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import type { ComponentRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";
import type { ComponentDefinition } from "@/lib/components/types";
import type { ComponentRecord } from "@/tool-ui";
import { ComponentsSidebar } from "./components-sidebar";
import { ComponentDetail } from "./component-detail";
import { ComponentsEmptyState } from "./components-empty-state";
import { ComponentCreateDialog } from "./component-create-dialog";
import { AddFromPoolDialog } from "@/components/pool/add-from-pool-dialog";
import { toPoolMeta } from "@/components/pool/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ComponentsPanel({ agentId }: { agentId: string }) {
  const { data: components = [], mutate } = useSWR<WithPoolMeta<ComponentRow>[]>(
    componentsApiKey(agentId),
    fetcher
  );
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);

  const activeComponent = useMemo(
    () => components.find((c) => c.id === activeComponentId) ?? null,
    [components, activeComponentId]
  );

  const allComponentRecords: ComponentRecord[] = useMemo(
    () =>
      components
        .filter((c) => c.componentSource.trim())
        .map((c) => ({ key: c.key, source: c.componentSource })),
    [components]
  );

  useEffect(() => {
    if (activeComponentId) {
      setMobileView("detail");
    }
  }, [activeComponentId]);

  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (key: string, name: string) => {
      const result = await createComponent(
        {
          agentId,
          key,
          name,
          description: "",
        },
        mutate
      );
      if (result?.id) {
        setActiveComponentId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [agentId, mutate]
  );

  const handleSave = useCallback(
    async (updated: ComponentDefinition) => {
      await updateComponent(
        updated.id,
        {
          name: updated.name,
          description: updated.description,
          toolInputSchema: updated.toolInputSchema,
          componentInputSchema: updated.componentInputSchema,
          componentSource: updated.componentSource,
        },
        mutate
      );
    },
    [mutate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteComponent(id, mutate);
      if (activeComponentId === id) setActiveComponentId(null);
    },
    [mutate, activeComponentId]
  );

  const handleRemoveRef = useCallback(
    async (refId: string) => {
      try {
        await removeAgentRef(agentId, refId, mutateRefs);
        await mutate();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove ref");
      }
    },
    [agentId, mutateRefs, mutate],
  );

  const handlePoolAdded = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <div className="flex h-full flex-col">
      <ComponentCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />
      <AddFromPoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        resourceType="component"
        agentId={agentId}
        onAdded={handlePoolAdded}
      />

      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <ComponentsSidebar
          components={components}
          activeComponentId={activeComponentId}
          onSelect={setActiveComponentId}
          onCreate={handleOpenCreateDialog}
          onAddFromPool={() => setPoolDialogOpen(true)}
          onRemoveRef={handleRemoveRef}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeComponent ? (
            <ComponentDetail
              key={activeComponent.id}
              component={activeComponent}
              agentId={agentId}
              allComponents={allComponentRecords}
              onSave={handleSave}
              onDelete={handleDelete}
              poolMeta={toPoolMeta(activeComponent)}
            />
          ) : (
            <ComponentsEmptyState onCreate={handleOpenCreateDialog} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeComponent ? (
          <ComponentsSidebar
            components={components}
            activeComponentId={activeComponentId}
            onSelect={setActiveComponentId}
            onCreate={handleOpenCreateDialog}
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
            <div className="flex-1 min-w-0 overflow-hidden">
              <ComponentDetail
                key={activeComponent.id}
                component={activeComponent}
                agentId={agentId}
                allComponents={allComponentRecords}
                onSave={handleSave}
                onDelete={handleDelete}
                poolMeta={toPoolMeta(activeComponent)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
