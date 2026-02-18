"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useEvalCases,
  useEvalJudgeConfigs,
  createEvalCase,
  updateEvalCase,
  deleteEvalCase,
  createJudgeConfig,
  updateJudgeConfig,
  deleteJudgeConfig,
  setDefaultJudgeConfig,
} from "@/lib/eval/hooks";
import DEFAULT_JUDGE_CONFIG from "@/db/seed-data/gmcc-advisor/eval-judge-config.json";
import { EvalRunProvider } from "@/lib/eval/eval-run-context";
import { EvalSidebar, type ActiveView } from "./eval-sidebar";
import { CaseDetail } from "./case-detail";
import { JudgeConfigDetail } from "./judge-config-detail";
import { ResultsPanel } from "./results-panel";
import { EvalEmptyState } from "./eval-empty-state";

interface EvalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export function EvalSheet({
  open,
  onOpenChange,
  agentId,
}: EvalSheetProps) {
  const { cases, mutate: mutateCases } = useEvalCases(agentId, open);
  const { configs, mutate: mutateConfigs } = useEvalJudgeConfigs(agentId, open);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">(
    "sidebar"
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

  const activeConfig = useMemo(
    () =>
      activeView?.type === "judge"
        ? configs.find((c) => c.id === activeView.id) ?? null
        : null,
    [configs, activeView]
  );

  useEffect(() => {
    if (activeView) {
      setMobileView("detail");
    }
  }, [activeView]);

  // ── Case handlers ──

  const handleCreateCase = useCallback(async () => {
    const result = await createEvalCase(
      {
        agentId,
        name: "New Case",
        input: "",
        expectedOutput: "",
        assertions: [],
      },
      mutateCases
    );
    if (result?.id) setActiveView({ type: "case", id: result.id });
  }, [mutateCases]);

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

  // ── Judge config handlers ──

  const handleCreateConfig = useCallback(async () => {
    const result = await createJudgeConfig(
      {
        agentId,
        name: "New Judge",
        model: DEFAULT_JUDGE_CONFIG.model,
        systemPrompt: DEFAULT_JUDGE_CONFIG.systemPrompt,
        temperature: DEFAULT_JUDGE_CONFIG.temperature,
      },
      mutateConfigs
    );
    if (result?.id) setActiveView({ type: "judge", id: result.id });
  }, [mutateConfigs]);

  const handleSaveConfig = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await updateJudgeConfig(id, data, mutateConfigs);
    },
    [mutateConfigs]
  );

  const handleDeleteConfig = useCallback(
    async (id: string) => {
      await deleteJudgeConfig(id, mutateConfigs);
      if (activeView?.type === "judge" && activeView.id === id) {
        setActiveView(null);
      }
    },
    [mutateConfigs, activeView]
  );

  const handleSetDefaultConfig = useCallback(
    async (id: string) => {
      await setDefaultJudgeConfig(id, mutateConfigs);
    },
    [mutateConfigs]
  );

  // ── Detail panel content ──

  function renderDetail() {
    if (activeView?.type === "case" && activeCase) {
      return (
        <CaseDetail
          key={activeCase.id}
          evalCase={activeCase}
          onSave={handleSaveCase}
          onDelete={handleDeleteCase}
        />
      );
    }
    if (activeView?.type === "judge" && activeConfig) {
      return (
        <JudgeConfigDetail
          key={activeConfig.id}
          config={activeConfig}
          onSave={handleSaveConfig}
          onDelete={handleDeleteConfig}
          onSetDefault={handleSetDefaultConfig}
        />
      );
    }
    if (activeView?.type === "results") {
      return (
        <ResultsPanel
          selectedTags={selectedTags}
        />
      );
    }
    return <EvalEmptyState />;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Evaluation</SheetTitle>
        <SheetDescription className="sr-only">
          Manage eval cases, judge configs, and run evaluations
        </SheetDescription>

        <EvalRunProvider>
          {/* Desktop layout */}
          <div className="hidden h-full sm:flex">
            <EvalSidebar
              cases={cases}
              configs={configs}
              activeView={activeView}
              onSelect={setActiveView}
              onCreateCase={handleCreateCase}
              onCreateConfig={handleCreateConfig}
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
                configs={configs}
                activeView={activeView}
                onSelect={setActiveView}
                onCreateCase={handleCreateCase}
                onCreateConfig={handleCreateConfig}
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
        </EvalRunProvider>
      </SheetContent>
    </Sheet>
  );
}
