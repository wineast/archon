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
import type { ToolRow } from "@/db/schema";
import type { ToolDefinition } from "@/lib/tools/types";
import { ToolsSidebar } from "./tools-sidebar";
import { ToolDetail } from "./tool-detail";
import { ToolsEmptyState } from "./tools-empty-state";
import { ToolCreateDialog } from "./tool-create-dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ToolsPanel({ agentId }: { agentId: string }) {
  const { data: tools = [], mutate } = useSWR<ToolRow[]>(
    toolsApiKey(agentId),
    fetcher
  );
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const activeTool = useMemo(
    () => tools.find((t) => t.id === activeToolId) ?? null,
    [tools, activeToolId]
  );

  useEffect(() => {
    if (activeToolId) {
      setMobileView("detail");
    }
  }, [activeToolId]);

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
          parameters: [],
          output: "{}",
          handler: "",
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
          parameters: updated.parameters,
          returnParameters: updated.returnParameters,
          output: updated.output,
          handler: updated.handler,
          component: updated.component,
          componentSource: updated.componentSource,
          componentMockData: updated.componentMockData,
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

  return (
    <div className="flex h-full flex-col">
      <ToolCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />

      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <ToolsSidebar
          tools={tools}
          activeToolId={activeToolId}
          onSelect={setActiveToolId}
          onCreate={handleOpenCreateDialog}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeTool ? (
            <ToolDetail
              key={activeTool.id}
              tool={activeTool}
              agentId={agentId}
              onSave={handleSave}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ) : (
            <ToolsEmptyState onCreate={handleOpenCreateDialog} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeTool ? (
          <ToolsSidebar
            tools={tools}
            activeToolId={activeToolId}
            onSelect={setActiveToolId}
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
              <ToolDetail
                key={activeTool.id}
                tool={activeTool}
                onSave={handleSave}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
