"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ToolsSheet({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
  const { data: tools = [], mutate } = useSWR<ToolRow[]>(
    open ? toolsApiKey(agentId) : null,
    fetcher
  );
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");

  const activeTool = useMemo(
    () => tools.find((t) => t.id === activeToolId) ?? null,
    [tools, activeToolId]
  );

  useEffect(() => {
    if (activeToolId) {
      setMobileView("detail");
    }
  }, [activeToolId]);

  const handleCreate = useCallback(async () => {
    const result = await createTool(
      {
        agentId,
        name: "newTool",
        description: "",
        parameters: [],
        output: "{}",
        handler: "",
        enabled: true,
      },
      mutate
    );
    if (result?.id) setActiveToolId(result.id);
  }, [mutate]);

  const handleSave = useCallback(
    async (updated: ToolDefinition) => {
      await updateTool(
        updated.id,
        {
          name: updated.name,
          description: updated.description,
          parameters: updated.parameters,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Tools</SheetTitle>
        <SheetDescription className="sr-only">
          Manage your tool definitions
        </SheetDescription>

        {/* Desktop layout */}
        <div className="hidden h-full sm:flex">
          <ToolsSidebar
            tools={tools}
            activeToolId={activeToolId}
            onSelect={setActiveToolId}
            onCreate={handleCreate}
          />
          <div className="flex-1 overflow-hidden">
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
              <ToolsEmptyState onCreate={handleCreate} />
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
      </SheetContent>
    </Sheet>
  );
}
