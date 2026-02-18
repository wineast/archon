"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ModelConfigSheet({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
  const { data: configs = [], mutate: listMutate } = useSWR<ModelConfigRow[]>(
    open ? modelConfigsApiKey(agentId) : null,
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

  const activeConfig = useMemo(
    () => configs.find((c) => c.id === activeConfigId) ?? null,
    [configs, activeConfigId]
  );

  useEffect(() => {
    if (activeConfigId) {
      setMobileView("detail");
    }
  }, [activeConfigId]);

  const handleCreate = useCallback(async () => {
    const result = await createModelConfig(
      {
        agentId,
        name: "New Config",
        systemPrompt: "",
        temperature: 0.7,
      },
      listMutate
    );
    if (result?.id) setActiveConfigId(result.id);
  }, [listMutate]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Model Configs</SheetTitle>
        <SheetDescription className="sr-only">
          Manage your model configuration presets
        </SheetDescription>

        {/* Desktop layout */}
        <div className="hidden h-full sm:flex">
          <ModelConfigSidebar
            configs={configs}
            activeConfigId={activeConfigId}
            onSelect={setActiveConfigId}
            onCreate={handleCreate}
          />
          <div className="flex-1 overflow-hidden">
            {activeConfig ? (
              <ModelConfigDetail
                key={activeConfig.id}
                config={activeConfig}
                onSave={handleSave}
                onDelete={handleDelete}
                onActivate={handleActivate}
                onPull={handlePull}
              />
            ) : (
              <ModelConfigEmptyState onCreate={handleCreate} />
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
              onCreate={handleCreate}
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
      </SheetContent>
    </Sheet>
  );
}
