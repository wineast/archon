"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useFunctions,
  createFunction,
  updateFunction,
  deleteFunction,
} from "@/lib/functions/hooks";
import { removeAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import { FunctionsSidebar } from "./functions-sidebar";
import { FunctionDetail } from "./function-detail";
import { FunctionsEmptyState } from "./functions-empty-state";
import { FunctionCreateDialog } from "./function-create-dialog";
import { AddFromPoolDialog } from "@/components/pool/add-from-pool-dialog";
import { toPoolMeta } from "@/components/pool/types";

export function FunctionsPanel({ agentId }: { agentId: string }) {
  const { functions, mutate: mutateList } = useFunctions(agentId);
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [activeFunctionId, setActiveFunctionId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);

  const activeFunction = useMemo(
    () => (activeFunctionId ? functions.find((f) => f.id === activeFunctionId) ?? null : null),
    [activeFunctionId, functions]
  );

  useEffect(() => {
    if (activeFunctionId) {
      setMobileView("detail");
    }
  }, [activeFunctionId]);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateWithKey = useCallback(
    async (key: string, name: string) => {
      const result = await createFunction(
        { key, name, description: "", code: "// Write your function here\n", agentId },
        mutateList
      );
      if (result?.id) {
        setActiveFunctionId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [mutateList, agentId]
  );

  const handleSave = useCallback(
    async (
      id: string,
      data: Record<string, unknown>
    ) => {
      await updateFunction(id, data, mutateList);
    },
    [mutateList]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteFunction(id, mutateList);
      if (activeFunctionId === id) setActiveFunctionId(null);
    },
    [mutateList, activeFunctionId]
  );

  const handleRemoveRef = useCallback(
    async (refId: string) => {
      try {
        await removeAgentRef(agentId, refId, mutateRefs);
        await mutateList();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove ref");
      }
    },
    [agentId, mutateRefs, mutateList],
  );

  const handlePoolAdded = useCallback(() => {
    mutateList();
  }, [mutateList]);

  /** Render the right-side detail panel based on active selection */
  function renderDetail() {
    if (activeFunction) {
      return (
        <FunctionDetail
          key={activeFunction.id}
          agentId={agentId}
          fn={activeFunction}
          onSave={handleSave}
          onDelete={handleDelete}
          poolMeta={toPoolMeta(activeFunction)}
        />
      );
    }
    return <FunctionsEmptyState onCreate={openCreateDialog} />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <FunctionsSidebar
          functions={functions}
          activeFunctionId={activeFunctionId}
          onSelect={setActiveFunctionId}
          onCreate={openCreateDialog}
          onAddFromPool={() => setPoolDialogOpen(true)}
          onRemoveRef={handleRemoveRef}
        />
        <div className="flex-1 overflow-hidden">{renderDetail()}</div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeFunction ? (
          <FunctionsSidebar
            functions={functions}
            activeFunctionId={activeFunctionId}
            onSelect={setActiveFunctionId}
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
            <div className="flex-1 overflow-hidden">{renderDetail()}</div>
          </>
        )}
      </div>

      <FunctionCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWithKey}
      />
      <AddFromPoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        resourceType="function"
        agentId={agentId}
        onAdded={handlePoolAdded}
      />
    </div>
  );
}
