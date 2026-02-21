"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import useSWR from "swr";
import {
  useMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
} from "@/lib/mcp-servers/hooks";
import { McpServersSidebar } from "./mcp-servers-sidebar";
import { McpServerDetail } from "./mcp-server-detail";
import { McpServersEmptyState } from "./mcp-servers-empty-state";
import { McpServerCreateDialog } from "./mcp-server-create-dialog";
import type { AgentRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function McpServersPanel({ agentId }: { agentId: string }) {
  const { mcpServers, mutate: mutateList } = useMcpServers(agentId);
  const { data: agent, mutate: mutateAgent } = useSWR<AgentRow>(
    `/api/agents/${agentId}`,
    fetcher
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const mcpEnabled = agent?.mcpEnabled ?? true;
  const activeMcpServer = mcpServers.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    if (activeId) {
      setMobileView("detail");
    }
  }, [activeId]);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateWithKey = useCallback(
    async (key: string, name: string) => {
      const result = await createMcpServer(
        { key, name, agentId },
        mutateList
      );
      if (result?.id) {
        setActiveId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [mutateList, agentId]
  );

  const handleSave = useCallback(
    async (
      id: string,
      data: {
        name: string;
        description: string;
        url: string;
        transportType: string;
        headers: Record<string, string>;
      }
    ) => {
      await updateMcpServer(id, data, mutateList);
    },
    [mutateList]
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await updateMcpServer(id, { enabled }, mutateList);
    },
    [mutateList]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMcpServer(id, mutateList);
      if (activeId === id) setActiveId(null);
    },
    [mutateList, activeId]
  );

  const handleToggleMcp = useCallback(
    async (enabled: boolean) => {
      await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcpEnabled: enabled }),
      });
      mutateAgent();
    },
    [agentId, mutateAgent]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <McpServersSidebar
          mcpServers={mcpServers}
          activeId={activeId}
          mcpEnabled={mcpEnabled}
          onSelect={setActiveId}
          onCreate={openCreateDialog}
          onToggleMcp={handleToggleMcp}
        />
        <div className="flex-1 overflow-hidden">
          {activeMcpServer ? (
            <McpServerDetail
              key={activeMcpServer.id}
              mcpServer={activeMcpServer}
              onSave={handleSave}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ) : (
            <McpServersEmptyState onCreate={openCreateDialog} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeMcpServer ? (
          <McpServersSidebar
            mcpServers={mcpServers}
            activeId={activeId}
            mcpEnabled={mcpEnabled}
            onSelect={setActiveId}
            onCreate={openCreateDialog}
            onToggleMcp={handleToggleMcp}
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
              <McpServerDetail
                key={activeMcpServer.id}
                mcpServer={activeMcpServer}
                onSave={handleSave}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            </div>
          </>
        )}
      </div>

      <McpServerCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWithKey}
      />
    </div>
  );
}
