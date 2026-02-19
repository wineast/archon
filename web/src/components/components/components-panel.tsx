"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  componentsApiKey,
  createComponent,
  updateComponent,
  deleteComponent,
} from "@/lib/components/hooks";
import type { ComponentRow } from "@/db/schema";
import type { ComponentDefinition } from "@/lib/components/types";
import type { ComponentRecord } from "@/tool-ui";
import { ComponentsSidebar } from "./components-sidebar";
import { ComponentDetail } from "./component-detail";
import { ComponentsEmptyState } from "./components-empty-state";
import { ComponentCreateDialog } from "./component-create-dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ComponentsPanel({ agentId }: { agentId: string }) {
  const { data: components = [], mutate } = useSWR<ComponentRow[]>(
    componentsApiKey(agentId),
    fetcher
  );
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      <ComponentCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />

      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <ComponentsSidebar
          components={components}
          activeComponentId={activeComponentId}
          onSelect={setActiveComponentId}
          onCreate={handleOpenCreateDialog}
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
                allComponents={allComponentRecords}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
