"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  modelConfigsApiKey,
  activeModelConfigApiKey,
  createModelConfig,
  updateModelConfig,
  deleteModelConfig,
  activateModelConfig,
} from "@/lib/model-config/hooks";
import type { ModelConfigRow } from "@/db/schema";
import useSWR from "swr";
import { ModelConfigSidebar } from "./model-config-sidebar";
import { ModelConfigDetail } from "./model-config-detail";
import { ModelConfigEmptyState } from "./model-config-empty-state";
import { ModelConfigCreateDialog } from "./model-config-create-dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ModelConfigPanel({ agentId }: { agentId: string }) {
  const { data: configs = [], mutate: listMutate } = useSWR<ModelConfigRow[]>(
    modelConfigsApiKey(agentId),
    fetcher
  );
  const { mutate: activeMutate } = useSWR<ModelConfigRow | null>(
    activeModelConfigApiKey(agentId),
    fetcher
  );
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">(
    "sidebar"
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const activeConfig = useMemo(
    () => configs.find((c) => c.id === activeConfigId) ?? null,
    [configs, activeConfigId]
  );

  useEffect(() => {
    if (activeConfigId) {
      setMobileView("detail");
    }
  }, [activeConfigId]);

  const handleCreate = useCallback(
    async (key: string, name: string) => {
      const result = await createModelConfig(
        {
          agentId,
          key,
          name,
          systemPrompt: "",
          temperature: 0.7,
        },
        listMutate
      );
      if (result?.id) {
        setActiveConfigId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [agentId, listMutate]
  );

  const handleSave = useCallback(
    async (
      id: string,
      data: { name: string; modelId: string; systemPrompt: string; temperature: number }
    ) => {
      await updateModelConfig(id, data, listMutate);
      // Also revalidate active config in case name/prompt changed for the active one
      activeMutate();
    },
    [listMutate, activeMutate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteModelConfig(id, listMutate);
      if (activeConfigId === id) setActiveConfigId(null);
    },
    [listMutate, activeConfigId]
  );

  const handleActivate = useCallback(
    async (id: string) => {
      await activateModelConfig(id, listMutate, activeMutate);
    },
    [listMutate, activeMutate]
  );

  const handlePull = useCallback(async () => {
    const fresh = await listMutate();
    if (!fresh || !activeConfigId) return null;
    return fresh.find((c) => c.id === activeConfigId) ?? null;
  }, [listMutate, activeConfigId]);

  const openCreateDialog = useCallback(() => setCreateDialogOpen(true), []);

  return (
    <div className="flex h-full flex-col">
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <ModelConfigSidebar
          configs={configs}
          activeConfigId={activeConfigId}
          onSelect={setActiveConfigId}
          onCreate={openCreateDialog}
        />
        <div className="flex-1 overflow-hidden">
          {activeConfig ? (
            <ModelConfigDetail
              key={activeConfig.id}
              config={activeConfig}
              agentId={agentId}
              onSave={handleSave}
              onDelete={handleDelete}
              onActivate={handleActivate}
              onPull={handlePull}
            />
          ) : (
            <ModelConfigEmptyState onCreate={openCreateDialog} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeConfig ? (
          <ModelConfigSidebar
            configs={configs}
            activeConfigId={activeConfigId}
            onSelect={setActiveConfigId}
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
              <ModelConfigDetail
                key={activeConfig.id}
                config={activeConfig}
                onSave={handleSave}
                onDelete={handleDelete}
                onActivate={handleActivate}
                onPull={handlePull}
              />
            </div>
          </>
        )}
      </div>

      <ModelConfigCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
