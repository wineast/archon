"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useEvalCases,
  useEvalBatches,
  createEvalCase,
  updateEvalCase,
  deleteEvalCase,
  batchRefreshTools,
} from "@/lib/eval/hooks";
import { EvalBatchProvider } from "@/lib/eval/eval-run-context";
import { EvalSidebar, type ActiveView } from "./eval-sidebar";
import { CaseDetail } from "./case-detail";
import { ResultsPanel } from "./results-panel";
import { BenchmarkPanel } from "./benchmark-panel";
import { EvalEmptyState } from "./eval-empty-state";
import { EvalCaseCreateDialog } from "./eval-case-create-dialog";

export function EvalPanel({ agentId }: { agentId: string }) {
  const { cases, mutate: mutateCases } = useEvalCases(agentId, true);
  const { batches, mutate: mutateBatches } = useEvalBatches(agentId);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">(
    "sidebar"
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [batchRefreshing, setBatchRefreshing] = useState(false);

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const activeCase = useMemo(
    () =>
      activeView?.type === "case"
        ? cases.find((c) => c.id === activeView.id) ?? null
        : null,
    [cases, activeView]
  );

  useEffect(() => {
    if (activeView) {
      setMobileView("detail");
    }
  }, [activeView]);

  // ── Case handlers ──

  const handleCreateCase = useCallback(
    async (key: string, name: string) => {
      const result = await createEvalCase(
        {
          agentId,
          key,
          name,
          mode: "single",
          turns: [],
          expectedOutput: "",
          assertions: [],
        },
        mutateCases
      );
      if (result?.id) {
        setActiveView({ type: "case", id: result.id });
        setCaseDialogOpen(false);
      }
    },
    [agentId, mutateCases]
  );

  const handleSaveCase = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await updateEvalCase(id, data, mutateCases);
    },
    [mutateCases]
  );

  const handleDeleteCase = useCallback(
    async (id: string) => {
      await deleteEvalCase(id, mutateCases);
      if (activeView?.type === "case" && activeView.id === id) {
        setActiveView(null);
      }
    },
    [mutateCases, activeView]
  );

  const handleBatchRefreshTools = useCallback(async () => {
    setBatchRefreshing(true);
    try {
      const result = await batchRefreshTools(agentId, mutateCases);
      if (result) {
        if (result.errors.length > 0) {
          toast.error(
            `Refreshed ${result.casesRefreshed} cases (${result.totalToolCalls} tool calls), ${result.errors.length} errors: ${result.errors[0]}`
          );
        } else {
          toast.success(
            `Refreshed ${result.casesRefreshed} cases (${result.totalToolCalls} tool calls)`
          );
        }
      }
    } finally {
      setBatchRefreshing(false);
    }
  }, [agentId, mutateCases]);

  // ── Detail panel content ──

  function renderDetail() {
    if (activeView?.type === "case" && activeCase) {
      return (
        <CaseDetail
          key={activeCase.id}
          evalCase={activeCase}
          agentId={agentId}
          onSave={handleSaveCase}
          onDelete={handleDeleteCase}
        />
      );
    }
    if (activeView?.type === "results") {
      return (
        <ResultsPanel
          agentId={agentId}
          selectedTags={selectedTags}
        />
      );
    }
    if (activeView?.type === "benchmark") {
      return <BenchmarkPanel agentId={agentId} />;
    }
    return <EvalEmptyState />;
  }

  const openCaseDialog = useCallback(() => setCaseDialogOpen(true), []);

  return (
    <div className="flex h-full flex-col">
      <EvalBatchProvider batches={batches} mutateBatches={mutateBatches}>
        {/* Desktop layout */}
        <div className="hidden h-full sm:flex">
          <EvalSidebar
            cases={cases}
            activeView={activeView}
            onSelect={setActiveView}
            onCreateCase={openCaseDialog}
            onBatchRefreshTools={handleBatchRefreshTools}
            batchRefreshing={batchRefreshing}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
          />
          <div className="flex-1 overflow-hidden">{renderDetail()}</div>
        </div>

        {/* Mobile layout */}
        <div className="flex h-full flex-col sm:hidden">
          {mobileView === "sidebar" || !activeView ? (
            <EvalSidebar
              cases={cases}
              activeView={activeView}
              onSelect={setActiveView}
              onCreateCase={openCaseDialog}
              onBatchRefreshTools={handleBatchRefreshTools}
              batchRefreshing={batchRefreshing}
              selectedTags={selectedTags}
              onToggleTag={handleToggleTag}
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
      </EvalBatchProvider>

      <EvalCaseCreateDialog
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
        onCreate={handleCreateCase}
      />
    </div>
  );
}
