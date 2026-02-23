"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  toolsApiKey,
  createTool,
  updateTool,
  deleteTool,
  toggleToolEnabled,
} from "@/lib/tools/hooks";
import { useSkills } from "@/lib/skills/hooks";
import { removeAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import type { ToolRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";
import { toPoolMeta } from "@/components/pool/types";
import type { ToolDefinition } from "@/lib/tools/types";
import { ToolsSidebar } from "./tools-sidebar";
import { ToolDetail } from "./tool-detail";
import { BuiltinToolDetail } from "./builtin-tool-detail";
import { ToolsEmptyState } from "./tools-empty-state";
import { ToolCreateDialog } from "./tool-create-dialog";
import { AddFromPoolDialog } from "@/components/pool/add-from-pool-dialog";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ToolsPanel({ agentId, skillsEnabled = true }: { agentId: string; skillsEnabled?: boolean }) {
  const { data: tools = [], mutate } = useSWR<WithPoolMeta<ToolRow>[]>(
    toolsApiKey(agentId),
    fetcher
  );
  const { skills } = useSkills(agentId);
  const hasEnabledSkills = useMemo(
    () => skillsEnabled && skills.some((s) => s.enabled),
    [skillsEnabled, skills]
  );
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [activeBuiltinToolKey, setActiveBuiltinToolKey] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);

  const activeTool = useMemo(
    () => tools.find((t) => t.id === activeToolId) ?? null,
    [tools, activeToolId]
  );

  const handleSelectTool = useCallback((id: string) => {
    setActiveToolId(id);
    setActiveBuiltinToolKey(null);
  }, []);

  const handleSelectBuiltin = useCallback((key: string) => {
    setActiveBuiltinToolKey(key);
    setActiveToolId(null);
  }, []);

  useEffect(() => {
    if (activeToolId || activeBuiltinToolKey) {
      setMobileView("detail");
    }
  }, [activeToolId, activeBuiltinToolKey]);

  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (key: string, name: string) => {
      const result = await createTool(
        {
          agentId,
          key,
          name,
          description: "",
          handler: null,
          url: null,
          enabled: true,
        },
        mutate
      );
      if (result?.id) {
        setActiveToolId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [agentId, mutate]
  );

  const handleSave = useCallback(
    async (updated: ToolDefinition) => {
      await updateTool(
        updated.id,
        {
          name: updated.name,
          description: updated.description,
          parametersSchema: updated.parametersSchema ?? null,
          returnParametersSchema: updated.returnParametersSchema ?? null,
          handler: updated.handler,
          url: updated.url,
          componentId: updated.componentId,
          uiHidden: updated.uiHidden,
          sandboxMode: updated.sandboxMode,
        },
        mutate
      );
    },
    [mutate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteTool(id, mutate);
      if (activeToolId === id) setActiveToolId(null);
    },
    [mutate, activeToolId]
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await toggleToolEnabled(id, enabled, mutate);
    },
    [mutate]
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
      <ToolCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />
      <AddFromPoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        resourceType="tool"
        agentId={agentId}
        onAdded={handlePoolAdded}
      />

      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <ToolsSidebar
          tools={tools}
          activeToolId={activeToolId}
          onSelect={handleSelectTool}
          onCreate={handleOpenCreateDialog}
          hasEnabledSkills={hasEnabledSkills}
          onSelectBuiltin={handleSelectBuiltin}
          activeBuiltinToolKey={activeBuiltinToolKey}
          onAddFromPool={() => setPoolDialogOpen(true)}
          onRemoveRef={handleRemoveRef}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeBuiltinToolKey ? (
            <BuiltinToolDetail toolKey={activeBuiltinToolKey} />
          ) : activeTool ? (
            <ToolDetail
              key={activeTool.id}
              tool={activeTool}
              agentId={agentId}
              onSave={handleSave}
              onDelete={handleDelete}
              onToggle={handleToggle}
              poolMeta={toPoolMeta(activeTool)}
            />
          ) : (
            <ToolsEmptyState onCreate={handleOpenCreateDialog} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || (!activeTool && !activeBuiltinToolKey) ? (
          <ToolsSidebar
            tools={tools}
            activeToolId={activeToolId}
            onSelect={handleSelectTool}
            onCreate={handleOpenCreateDialog}
            hasEnabledSkills={hasEnabledSkills}
            onSelectBuiltin={handleSelectBuiltin}
            activeBuiltinToolKey={activeBuiltinToolKey}
            onAddFromPool={() => setPoolDialogOpen(true)}
            onRemoveRef={handleRemoveRef}
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
              {activeBuiltinToolKey ? (
                <BuiltinToolDetail toolKey={activeBuiltinToolKey} />
              ) : activeTool ? (
                <ToolDetail
                  key={activeTool.id}
                  tool={activeTool}
                  agentId={agentId}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  poolMeta={toPoolMeta(activeTool)}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
