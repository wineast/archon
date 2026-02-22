"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  wikiApiKey,
  wikiFetcher,
  createDocument,
  updateDocument,
  deleteDocument,
  reorderDocument,
  moveDocument,
} from "@/lib/wiki/api";
import type { WikiDocumentWithPool } from "@/lib/wiki/api";
import { removeAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import { WikiEditor } from "@/components/editors/wiki-editor";
import { WikiEmptyState } from "./wiki-empty-state";
import { WikiSidebar } from "./wiki-sidebar";
import { WikiCreateDialog } from "./wiki-create-dialog";
import { AddFromPoolDialog } from "@/components/pool/add-from-pool-dialog";

export function WikiPanel({ agentId }: { agentId: string }) {
  const { data: documents = [], mutate } = useSWR<WikiDocumentWithPool[]>(
    wikiApiKey(agentId),
    wikiFetcher
  );
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "editor">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | undefined>();

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? null,
    [documents, activeDocId]
  );

  const createParentName = useMemo(() => {
    if (!createParentId) return undefined;
    return documents.find((d) => d.id === createParentId)?.name;
  }, [documents, createParentId]);

  useEffect(() => {
    if (activeDocId) {
      setMobileView("editor");
    }
  }, [activeDocId]);

  const handleOpenCreateDialog = useCallback((parentId?: string) => {
    setCreateParentId(parentId);
    setCreateDialogOpen(true);
  }, []);

  const handleCreateDocument = useCallback(
    async (name: string, key: string) => {
      const id = await createDocument(documents, mutate, agentId, name, key, createParentId);
      if (id) {
        setActiveDocId(id);
        setCreateDialogOpen(false);
        setCreateParentId(undefined);
      }
    },
    [documents, mutate, agentId, createParentId]
  );

  const handleUpdate = useCallback(
    async (id: string, updates: { name: string; content: string }) => {
      return updateDocument(id, updates, documents, mutate);
    },
    [documents, mutate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await deleteDocument(id, documents, mutate);
      if (ok && activeDocId === id) setActiveDocId(null);
      return ok;
    },
    [documents, mutate, activeDocId]
  );

  const handleReorder = useCallback(
    async (id: string, direction: "up" | "down") => {
      await reorderDocument(id, direction, documents, mutate, agentId);
    },
    [documents, mutate, agentId]
  );

  const handleMove = useCallback(
    async (id: string, targetParentId: string | null) => {
      await moveDocument(id, targetParentId, documents, mutate);
    },
    [documents, mutate]
  );

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) setCreateParentId(undefined);
  }, []);

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
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <WikiSidebar
          documents={documents}
          activeDocId={activeDocId}
          onSelect={setActiveDocId}
          onCreate={handleOpenCreateDialog}
          onDelete={handleDelete}
          onReorder={handleReorder}
          onMove={handleMove}
          onAddFromPool={() => setPoolDialogOpen(true)}
          onRemoveRef={handleRemoveRef}
        />
        <div className="flex-1 overflow-hidden">
          {activeDoc ? (
            <WikiEditor
              doc={activeDoc}
              documents={documents}
              agentId={agentId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : (
            <WikiEmptyState onCreate={() => handleOpenCreateDialog()} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeDoc ? (
          <WikiSidebar
            documents={documents}
            activeDocId={activeDocId}
            onSelect={setActiveDocId}
            onCreate={handleOpenCreateDialog}
            onDelete={handleDelete}
            onReorder={handleReorder}
            onMove={handleMove}
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
              <WikiEditor
                doc={activeDoc}
                documents={documents}
                agentId={agentId}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}
      </div>

      <WikiCreateDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        onCreate={handleCreateDocument}
        parentName={createParentName}
      />
      <AddFromPoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        resourceType="wiki"
        agentId={agentId}
        onAdded={handlePoolAdded}
      />
    </div>
  );
}
