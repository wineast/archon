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
import { BUILTIN_FUNCTIONS } from "@/lib/functions/builtin";
import type { BuiltinFunction } from "@/lib/functions/builtin";
import { FunctionsSidebar } from "./functions-sidebar";
import { FunctionDetail } from "./function-detail";
import { FunctionBuiltinDetail } from "./function-builtin-detail";
import { FunctionsEmptyState } from "./functions-empty-state";
import { FunctionCreateDialog } from "./function-create-dialog";
import { AddFromPoolDialog } from "@/components/pool/add-from-pool-dialog";
import { toPoolMeta } from "@/components/pool/types";

/** Map builtin key → BuiltinFunction for quick lookup */
const builtinByKey = new Map<string, BuiltinFunction>(
  BUILTIN_FUNCTIONS.map((fn) => [fn.key, fn])
);

function parseActiveId(id: string | null): {
  type: "builtin" | "dynamic" | null;
  key: string | null;
} {
  if (!id) return { type: null, key: null };
  if (id.startsWith("builtin:")) {
    return { type: "builtin", key: id.slice("builtin:".length) };
  }
  return { type: "dynamic", key: id };
}

export function FunctionsPanel({ agentId }: { agentId: string }) {
  const { functions, mutate: mutateList } = useFunctions(agentId);
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [activeFunctionId, setActiveFunctionId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);

  const { type: activeType, key: activeKey } = useMemo(
    () => parseActiveId(activeFunctionId),
    [activeFunctionId]
  );

  // Find dynamic function from the list (preserves pool meta)
  const activeFunction = useMemo(
    () => (activeType === "dynamic" && activeKey ? functions.find((f) => f.id === activeKey) ?? null : null),
    [activeType, activeKey, functions]
  );

  // Resolve the selected builtin function
  const activeBuiltin =
    activeType === "builtin" && activeKey ? builtinByKey.get(activeKey) ?? null : null;

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
    if (activeBuiltin) {
      return <FunctionBuiltinDetail key={activeBuiltin.key} fn={activeBuiltin} />;
    }
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

  const hasActiveSelection = activeBuiltin || activeFunction;

  return (
    <div className="flex h-full flex-col">
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <FunctionsSidebar
          builtinFunctions={BUILTIN_FUNCTIONS}
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
        {mobileView === "sidebar" || !hasActiveSelection ? (
          <FunctionsSidebar
            builtinFunctions={BUILTIN_FUNCTIONS}
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
