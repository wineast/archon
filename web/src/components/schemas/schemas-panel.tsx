"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useSchemas,
  createSchema,
  updateSchema,
  deleteSchema,
} from "@/lib/schemas/hooks";
import { removeAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import type { SchemaFormValues } from "./schema-form";
import { SchemasSidebar } from "./schemas-sidebar";
import { SchemaDetail } from "./schema-detail";
import { SchemasEmptyState } from "./schemas-empty-state";
import { SchemaCreateDialog } from "./schema-create-dialog";
import { AddFromPoolDialog } from "@/components/pool/add-from-pool-dialog";

export function SchemasPanel({ agentId }: { agentId: string }) {
  const { schemas, mutate } = useSchemas(agentId);
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [activeSchemaId, setActiveSchemaId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);

  const activeSchema = useMemo(
    () => schemas.find((s) => s.id === activeSchemaId) ?? null,
    [schemas, activeSchemaId]
  );

  useEffect(() => {
    if (activeSchemaId) {
      setMobileView("detail");
    }
  }, [activeSchemaId]);

  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (key: string, name: string) => {
      const result = await createSchema(
        { agentId, key, name, description: "", parameters: [] },
        mutate
      );
      if (result?.id) {
        setActiveSchemaId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [agentId, mutate]
  );

  const handleSave = useCallback(
    async (id: string, data: Omit<SchemaFormValues, "key">) => {
      await updateSchema(id, data, mutate);
    },
    [mutate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await deleteSchema(id, mutate);
      if (ok && activeSchemaId === id) setActiveSchemaId(null);
    },
    [mutate, activeSchemaId]
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
      <SchemaCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />
      <AddFromPoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        resourceType="schema"
        agentId={agentId}
        onAdded={handlePoolAdded}
      />

      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <SchemasSidebar
          schemas={schemas}
          activeSchemaId={activeSchemaId}
          onSelect={setActiveSchemaId}
          onCreate={handleOpenCreateDialog}
          onAddFromPool={() => setPoolDialogOpen(true)}
          onRemoveRef={handleRemoveRef}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeSchema ? (
            <SchemaDetail
              key={activeSchema.id}
              schema={activeSchema}
              allSchemas={schemas}
              onSave={handleSave}
              agentId={agentId}
              onDelete={handleDelete}
            />
          ) : (
            <SchemasEmptyState onCreate={handleOpenCreateDialog} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeSchema ? (
          <SchemasSidebar
            schemas={schemas}
            activeSchemaId={activeSchemaId}
            onSelect={setActiveSchemaId}
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
              <SchemaDetail
                key={activeSchema.id}
                schema={activeSchema}
                allSchemas={schemas}
                agentId={agentId}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
