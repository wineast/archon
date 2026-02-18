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
  wikiApiKey,
  wikiFetcher,
  createDocument,
  updateDocument,
  deleteDocument,
  reorderDocument,
} from "@/lib/wiki/api";
import { WikiEditor } from "./wiki-editor";
import { WikiEmptyState } from "./wiki-empty-state";
import { WikiSidebar } from "./wiki-sidebar";

export function WikiSheet({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
  const { data: documents = [], mutate } = useSWR(
    open ? wikiApiKey(agentId) : null,
    wikiFetcher
  );
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "editor">("sidebar");

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? null,
    [documents, activeDocId]
  );

  useEffect(() => {
    if (activeDocId) {
      setMobileView("editor");
    }
  }, [activeDocId]);

  const handleCreate = useCallback(async () => {
    const id = await createDocument(documents, mutate, agentId);
    if (id) setActiveDocId(id);
  }, [documents, mutate, agentId]);

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<{ title: string; content: string }>) => {
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Wiki</SheetTitle>
        <SheetDescription className="sr-only">
          Manage your wiki documents
        </SheetDescription>

        {/* Desktop layout */}
        <div className="hidden h-full sm:flex">
          <WikiSidebar
            documents={documents}
            activeDocId={activeDocId}
            onSelect={setActiveDocId}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
          <div className="flex-1 overflow-hidden">
            {activeDoc ? (
              <WikiEditor doc={activeDoc} documents={documents} onUpdate={handleUpdate} />
            ) : (
              <WikiEmptyState onCreate={handleCreate} />
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
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onReorder={handleReorder}
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
                <WikiEditor doc={activeDoc} documents={documents} onUpdate={handleUpdate} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
