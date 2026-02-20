"use client";

import { useCallback, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuideDialog } from "@/components/ui/guide-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import memoryGuide from "../../../guide/memory.md";
import {
  useMemoryConfig,
  updateMemoryConfig,
  useMemories,
  createMemory,
  updateMemory,
  deleteMemory,
} from "@/lib/memory/hooks";
import { MemoryConfigDetail } from "./memory-config-detail";
import { MemoryList } from "./memory-list";
import { MemoryEditSheet } from "./memory-edit-sheet";
import { MemoryCreateDialog } from "./memory-create-dialog";
import type { MemoryRow } from "@/db/schema";

export function MemoryPanel({ agentId }: { agentId: string }) {
  const { config, mutate: mutateConfig } = useMemoryConfig(agentId);
  const { memories, mutate: mutateMemories } = useMemories(agentId);
  const [editMemory, setEditMemory] = useState<MemoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemoryRow | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const allTypes = useMemo(
    () => (config?.memoryTypeDefs ?? []).map((t) => t.key),
    [config?.memoryTypeDefs]
  );

  const handleSaveConfig = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await updateMemoryConfig(id, data, mutateConfig);
    },
    [mutateConfig]
  );

  const handleCreate = useCallback(
    async (data: {
      type: string;
      content: string;
      userId?: string | null;
      importance?: number;
    }) => {
      const result = await createMemory(
        { agentId, ...data },
        mutateMemories
      );
      if (result?.id) {
        setCreateDialogOpen(false);
      }
    },
    [agentId, mutateMemories]
  );

  const handleSaveMemory = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await updateMemory(id, data, mutateMemories);
    },
    [mutateMemories]
  );

  const handleDeleteMemory = useCallback(async () => {
    if (!deleteTarget) return;
    const ok = await deleteMemory(deleteTarget.id, mutateMemories);
    if (ok) {
      setDeleteTarget(null);
      if (editMemory?.id === deleteTarget.id) setEditMemory(null);
    }
  }, [deleteTarget, mutateMemories, editMemory]);

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="config" className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-1.5">
          <span className="text-sm font-semibold">Memory</span>
          <GuideDialog title="记忆模块" content={memoryGuide} />
          <div className="flex-1" />
          <TabsList className="h-7">
            <TabsTrigger value="config" className="text-xs">
              Config
            </TabsTrigger>
            <TabsTrigger value="memories" className="text-xs">
              Memories
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="config" className="flex-1 min-h-0 mt-0">
          <MemoryConfigDetail
            config={config}
            onSave={handleSaveConfig}
          />
        </TabsContent>

        <TabsContent value="memories" className="flex-1 min-h-0 mt-0">
          <MemoryList
            memories={memories}
            onEdit={setEditMemory}
            onDelete={setDeleteTarget}
            onAdd={() => setCreateDialogOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <MemoryCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
        allTypes={allTypes}
      />

      <MemoryEditSheet
        open={!!editMemory}
        onOpenChange={(open) => {
          if (!open) setEditMemory(null);
        }}
        memory={editMemory}
        allTypes={allTypes}
        onSave={handleSaveMemory}
        onDelete={async (id) => {
          setDeleteTarget(memories.find((m) => m.id === id) ?? null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Memory"
        description="Are you sure you want to delete this memory? This action cannot be undone."
        onConfirm={handleDeleteMemory}
      />
    </div>
  );
}
