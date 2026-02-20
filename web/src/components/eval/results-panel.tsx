"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useEvalCases,
  useEvalJudgeConfigs,
  useEvalRuns,
  fetchEvalRunDetail,
  deleteEvalRun,
} from "@/lib/eval/hooks";
import { useTemplateVars } from "@/lib/eval/template-vars-hooks";
import { useEvalRun } from "@/lib/eval/eval-run-context";
import { useTools } from "@/lib/tools/hooks";
import { useModelConfigs, useActiveModelConfig } from "@/lib/model-config/hooks";
import { toEvalCase, toJudgeConfig, toEvalResult } from "@/lib/eval/types";
import type {
  EvalResult,
  CreateEvalRunResponse,
  RunCaseResponse,
  EvalRunDetail,
} from "@/lib/eval/types";
import type { EvalRunRow } from "@/db/schema";
import { useCallback, useState } from "react";
import { ResultCard } from "./result-card";
import {
  PlayIcon,
  Trash2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
} from "lucide-react";

interface ResultsPanelProps {
  agentId?: string;
  selectedTags: string[];
}

export function ResultsPanel({
  agentId,
  selectedTags,
}: ResultsPanelProps) {
  const { cases: caseRows } = useEvalCases(agentId);
  const { configs } = useEvalJudgeConfigs(agentId);
  const { templateVars } = useTemplateVars(agentId);
  const { tools: allDbTools } = useTools(agentId);
  const { configs: modelConfigs } = useModelConfigs(agentId);
  const { activeConfig: activeModelConfig } = useActiveModelConfig(agentId);
  const getEnabledToolNames = () =>
    allDbTools.filter((t) => t.enabled).map((t) => t.name);

  const { runs, mutate: mutateRuns } = useEvalRuns(agentId);
  const {
    isRunning,
    progress,
    runningCaseId,
    setRunning,
    setRunningCaseId,
    setProgress,
  } = useEvalRun();

  const [currentResults, setCurrentResults] = useState<EvalResult[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>(() => {
    return activeModelConfig?.id ?? "";
  });
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>(() => {
    const def = configs.find((c) => c.isDefault);
    return def?.id ?? "";
  });

  // Run detail expansion
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetailCache, setRunDetailCache] = useState<
    Record<string, EvalRunDetail>
  >({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  // Resolve selected judge config
  const selectedJudge = configs.find((c) => c.id === selectedJudgeId) ?? configs.find((c) => c.isDefault) ?? null;

  // Resolve selected model config (fallback to active)
  const resolvedConfigId = selectedConfigId || activeModelConfig?.id || "";

  const allCases = caseRows.map(toEvalCase);
  const cases =
    selectedTags.length > 0
      ? allCases.filter((c) => selectedTags.some((t) => c.tags?.includes(t)))
      : allCases;

  const handleRunAll = useCallback(async () => {
    if (cases.length === 0 || !selectedJudge || !resolvedConfigId) return;
    const judgeConfig = toJudgeConfig(selectedJudge);

    setRunning(true);
    setProgress(0);
    setCurrentResults([]);
    const allResults: EvalResult[] = [];

    // Step 1: Create a single run record
    let runId: string;
    try {
      const createRes = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelConfigId: resolvedConfigId,
          judgeConfigId: selectedJudge.id,
          judgeConfigName: judgeConfig.model,
          filterTags: selectedTags.length > 0 ? selectedTags : undefined,
          totalCases: cases.length,
        }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Failed to create run: HTTP ${createRes.status}: ${errText}`);
      }
      const { runId: id }: CreateEvalRunResponse = await createRes.json();
      runId = id;
    } catch (err) {
      setRunning(false);
      setProgress(0);
      // Show error for every case
      setCurrentResults(
        cases.map((c) => ({
          caseId: c.id,
          caseName: c.name,
          mode: c.mode,
          turns: c.turns,
          chatMessages: [],
          turnResults: [],
          chatResponse: "",
          assertionResults: [],
          allAssertionsPassed: false,
          judgeResult: null,
          timestamp: Date.now(),
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        }))
      );
      return;
    }

    // Step 2: Execute each case against the run
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      setRunningCaseId(c.id);
      setProgress((i / cases.length) * 100);

      try {
        const res = await fetch(`/api/eval/run/${runId}/case`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            case: c,
            judgeConfig,
            modelConfigId: resolvedConfigId,
            templateVars,
            toolNames: getEnabledToolNames(),
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          allResults.push({
            caseId: c.id,
            caseName: c.name,
            mode: c.mode,
            turns: c.turns,
            chatMessages: [],
            turnResults: [],
            chatResponse: "",
            assertionResults: [],
            allAssertionsPassed: false,
            judgeResult: null,
            timestamp: Date.now(),
            durationMs: 0,
            error: `HTTP ${res.status}: ${errText}`,
          });
        } else {
          const data: RunCaseResponse = await res.json();
          allResults.push(data.result);
        }
      } catch (err) {
        allResults.push({
          caseId: c.id,
          caseName: c.name,
          mode: c.mode,
          turns: c.turns,
          chatMessages: [],
          turnResults: [],
          chatResponse: "",
          assertionResults: [],
          allAssertionsPassed: false,
          judgeResult: null,
          timestamp: Date.now(),
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      setCurrentResults([...allResults]);
    }

    // Step 3: Finalize the run with aggregated stats
    try {
      await fetch(`/api/eval/run/${runId}`, { method: "PATCH" });
    } catch {
      // Non-critical: stats may be stale but results are saved
    }

    setProgress(100);
    setRunningCaseId(null);
    setRunning(false);
    mutateRuns();
  }, [
    cases,
    selectedJudge,
    resolvedConfigId,
    templateVars,
    selectedTags,
    setRunning,
    setProgress,
    setRunningCaseId,
    mutateRuns,
  ]);

  const handleToggleRunDetail = useCallback(
    async (runId: string) => {
      if (expandedRunId === runId) {
        setExpandedRunId(null);
        return;
      }
      setExpandedRunId(runId);
      if (!runDetailCache[runId]) {
        setLoadingDetail(runId);
        const detail = await fetchEvalRunDetail(runId);
        if (detail) {
          setRunDetailCache((prev) => ({ ...prev, [runId]: detail }));
        }
        setLoadingDetail(null);
      }
    },
    [expandedRunId, runDetailCache]
  );

  const handleDeleteRun = useCallback(
    async (runId: string) => {
      setDeletingRunId(runId);
      await deleteEvalRun(runId, mutateRuns);
      if (expandedRunId === runId) setExpandedRunId(null);
      setRunDetailCache((prev) => {
        const { [runId]: _, ...rest } = prev;
        return rest;
      });
      setDeletingRunId(null);
    },
    [mutateRuns, expandedRunId]
  );

  const displayResults = currentResults;
  const passedCount = displayResults.filter(
    (r) => r.allAssertionsPassed
  ).length;
  const scores = displayResults
    .map((r) => r.judgeResult?.overallScore)
    .filter((s): s is number => s != null);
  const avgScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
        ) / 10
      : null;

  const runningCaseName = cases.find((c) => c.id === runningCaseId)?.name;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b px-4 py-3">
        {/* Model Config + Judge selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground">
              Model Config
            </label>
            <Select value={resolvedConfigId} onValueChange={setSelectedConfigId}>
              <SelectTrigger className="mt-0.5 h-8 text-xs">
                <SelectValue placeholder="Select config..." />
              </SelectTrigger>
              <SelectContent>
                {modelConfigs.map((mc) => (
                  <SelectItem key={mc.id} value={mc.id} className="text-xs">
                    {mc.name}
                    {mc.isActive ? " (Active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground">
              Judge
            </label>
            <Select
              value={selectedJudge?.id ?? ""}
              onValueChange={setSelectedJudgeId}
            >
              <SelectTrigger className="mt-0.5 h-8 text-xs">
                <SelectValue placeholder="Select judge..." />
              </SelectTrigger>
              <SelectContent>
                {configs.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                    {c.isDefault ? " (Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleRunAll}
            disabled={isRunning || cases.length === 0 || !selectedJudge || !resolvedConfigId}
          >
            <PlayIcon className="mr-1 size-3" />
            {isRunning ? "Running..." : `Run All (${cases.length})`}
          </Button>
          {selectedTags.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Filtered: {selectedTags.join(", ")}
            </span>
          )}
        </div>

        {!selectedJudge && (
          <p className="text-xs text-muted-foreground">
            No judge config selected. Create and set one as default to run
            evaluations.
          </p>
        )}

        {isRunning && (
          <div className="space-y-1">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              {runningCaseName
                ? `Running: ${runningCaseName}`
                : "Starting..."}
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {/* Current run results */}
          {displayResults.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                Current Run
              </h3>
              <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Total:{" "}
                  <strong className="text-foreground">
                    {displayResults.length}
                  </strong>
                </span>
                <span>
                  Assertions Passed:{" "}
                  <strong className="text-foreground">
                    {passedCount}/{displayResults.length}
                  </strong>
                </span>
                {avgScore !== null && (
                  <span>
                    Avg Score:{" "}
                    <strong className="text-foreground">
                      {avgScore}/10
                    </strong>
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {displayResults.map((r) => (
                  <ResultCard key={r.caseId} result={r} />
                ))}
              </div>
            </>
          )}

          {/* Run history */}
          {runs.length > 0 && (
            <div className={displayResults.length > 0 ? "mt-6" : ""}>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                History
              </h3>
              <div className="space-y-1">
                {runs.map((run) => (
                  <RunHistoryItem
                    key={run.id}
                    run={run}
                    expanded={expandedRunId === run.id}
                    detail={runDetailCache[run.id]}
                    loadingDetail={loadingDetail === run.id}
                    deletingRun={deletingRunId === run.id}
                    onToggle={() => handleToggleRunDetail(run.id)}
                    onDelete={() => handleDeleteRun(run.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {!isRunning && displayResults.length === 0 && runs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No results yet. Click &quot;Run All&quot; to evaluate.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function RunHistoryItem({
  run,
  expanded,
  detail,
  loadingDetail,
  deletingRun,
  onToggle,
  onDelete,
}: {
  run: EvalRunRow;
  expanded: boolean;
  detail?: EvalRunDetail;
  loadingDetail: boolean;
  deletingRun: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const passRate =
    run.totalCases > 0
      ? `${run.passedAssertions}/${run.totalCases}`
      : "0/0";

  return (
    <div className="rounded-md border">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent cursor-pointer"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {expanded ? (
          <ChevronDownIcon className="size-3 shrink-0" />
        ) : (
          <ChevronRightIcon className="size-3 shrink-0" />
        )}
        <ClockIcon className="size-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">
          {new Date(run.createdAt).toLocaleString()}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {run.chatModel.split("/").pop()}
        </span>
        <span className="shrink-0 font-medium">{passRate}</span>
        {run.averageScore != null && (
          <span className="shrink-0 text-muted-foreground">
            {run.averageScore}/10
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          disabled={deletingRun}
        >
          {deletingRun ? (
            <Spinner className="size-3" />
          ) : (
            <Trash2Icon className="size-3" />
          )}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Eval Run"
        description="Are you sure you want to delete this eval run? This action cannot be undone."
        onConfirm={async () => {
          onDelete();
        }}
      />
      {expanded && (
        <div className="border-t px-3 py-2">
          {loadingDetail && (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              Loading details...
            </div>
          )}
          {detail && (
            <div className="space-y-3">
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>Judge: {run.judgeConfigName}</span>
                {run.filterTags.length > 0 && (
                  <span>Tags: {run.filterTags.join(", ")}</span>
                )}
              </div>
              {detail.results.map((r) => (
                <ResultCard key={r.id} result={toEvalResult(r)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
