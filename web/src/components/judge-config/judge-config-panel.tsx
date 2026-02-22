"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  judgeConfigsApiKey,
  activeJudgeConfigApiKey,
  createJudgeConfig,
  updateJudgeConfig,
  deleteJudgeConfig,
  activateJudgeConfig,
} from "@/lib/judge-config/hooks";
import type { JudgeConfigRow } from "@/db/schema";
import type { Dimension } from "@/lib/eval/types";
import useSWR from "swr";
import { JudgeConfigSidebar } from "./judge-config-sidebar";
import { JudgeConfigDetail } from "./judge-config-detail";
import { JudgeConfigEmptyState } from "./judge-config-empty-state";
import { JudgeConfigCreateDialog } from "./judge-config-create-dialog";
import { JudgeRecordsPanel } from "./judge-records-panel";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function JudgeConfigPanel({ agentId }: { agentId: string }) {
  const { data: configs = [], mutate: listMutate } = useSWR<JudgeConfigRow[]>(
    judgeConfigsApiKey(agentId),
    fetcher
  );
  const { mutate: activeMutate } = useSWR<JudgeConfigRow | null>(
    activeJudgeConfigApiKey(agentId),
    fetcher
  );
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
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
      const result = await createJudgeConfig(
        { agentId, key, name },
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
    async (id: string, data: { name: string; dimensions: Dimension[] }) => {
      await updateJudgeConfig(id, data, listMutate);
      activeMutate();
    },
    [listMutate, activeMutate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteJudgeConfig(id, listMutate);
      if (activeConfigId === id) setActiveConfigId(null);
    },
    [listMutate, activeConfigId]
  );

  const handleActivate = useCallback(
    async (id: string) => {
      await activateJudgeConfig(id, listMutate, activeMutate);
    },
    [listMutate, activeMutate]
  );

  const openCreateDialog = useCallback(() => setCreateDialogOpen(true), []);

  return (
    <div className="flex h-full flex-col">
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <JudgeConfigSidebar
          configs={configs}
          activeConfigId={activeConfigId}
          onSelect={setActiveConfigId}
          onCreate={openCreateDialog}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {activeConfig ? (
              <JudgeConfigDetail
                key={activeConfig.id}
                config={activeConfig}
                onSave={handleSave}
                onDelete={handleDelete}
                onActivate={handleActivate}
              />
            ) : (
              <JudgeConfigEmptyState onCreate={openCreateDialog} />
            )}
          </div>
          {!activeConfig && (
            <div className="border-t">
              <JudgeRecordsPanel agentId={agentId} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeConfig ? (
          <JudgeConfigSidebar
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
              <JudgeConfigDetail
                key={activeConfig.id}
                config={activeConfig}
                onSave={handleSave}
                onDelete={handleDelete}
                onActivate={handleActivate}
              />
            </div>
          </>
        )}
      </div>

      <JudgeConfigCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
