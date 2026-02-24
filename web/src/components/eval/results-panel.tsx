"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  useEvalCases,
  useEvalRuns,
  fetchEvalRunDetail,
  deleteEvalRun,
} from "@/lib/eval/hooks";
import { useTemplateVars } from "@/lib/eval/template-vars-hooks";
import { useEvalRun } from "@/lib/eval/eval-run-context";
import { useTools } from "@/lib/tools/hooks";
import { toEvalCase, toEvalResult } from "@/lib/eval/types";
import type {
  EvalResult,
  CreateEvalRunResponse,
  RunCaseResponse,
  EvalRunDetail,
  AssertionFailConfig,
} from "@/lib/eval/types";
import type { EvalRunRow } from "@/db/schema";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ResultCard } from "./result-card";
import { RunEvalDialog } from "./run-eval-dialog";
import {
  PlayIcon,
  Trash2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  BookmarkIcon,
} from "lucide-react";
import {
  setBaseline,
  clearBaseline,
  benchmarkTrendsKey,
  benchmarkModelsKey,
} from "@/lib/eval/benchmark-hooks";
import { useSWRConfig } from "swr";

interface ResultsPanelProps {
  agentId?: string;
  selectedTags: string[];
}

export function ResultsPanel({
  agentId,
  selectedTags,
}: ResultsPanelProps) {
  const { cases: caseRows } = useEvalCases(agentId);
  const { templateVars } = useTemplateVars(agentId);
  const { tools: allDbTools } = useTools(agentId);
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
  const [runDialogOpen, setRunDialogOpen] = useState(false);

  // Run detail expansion
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetailCache, setRunDetailCache] = useState<
    Record<string, EvalRunDetail>
  >({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  const allCases = caseRows.map(toEvalCase);
  const cases =
    selectedTags.length > 0
      ? allCases.filter((c) => selectedTags.some((t) => c.tags?.includes(t)))
      : allCases;

  const canRun = cases.length > 0;

  const handleRunAllConfirm = useCallback(async (params: {
    judgeAgentId: string;
    assertionFailConfig: AssertionFailConfig;
  }) => {
    if (!agentId) return;
    const { judgeAgentId, assertionFailConfig } = params;

    setRunDialogOpen(false);
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
          agentId,
          judgeAgentId,
          filterTags: selectedTags.length > 0 ? selectedTags : undefined,
          assertionFailConfig: Object.keys(assertionFailConfig).length > 0 ? assertionFailConfig : undefined,
          totalCases: cases.length,
        }),
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => null);
        const errMsg = errData?.error || `HTTP ${createRes.status}`;
        throw new Error(errMsg);
      }
      const { runId: id }: CreateEvalRunResponse = await createRes.json();
      runId = id;
    } catch (err) {
      setRunning(false);
      setProgress(0);
      toast.error(err instanceof Error ? err.message : String(err));
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
    agentId,
    cases,
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
        {/* Run action */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setRunDialogOpen(true)}
            disabled={isRunning || !canRun}
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
                    agentId={agentId}
                    expanded={expandedRunId === run.id}
                    detail={runDetailCache[run.id]}
                    loadingDetail={loadingDetail === run.id}
                    deletingRun={deletingRunId === run.id}
                    onToggle={() => handleToggleRunDetail(run.id)}
                    onDelete={() => handleDeleteRun(run.id)}
                    onBaselineChanged={mutateRuns}
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

      {agentId && (
        <RunEvalDialog
          open={runDialogOpen}
          onOpenChange={setRunDialogOpen}
          agentId={agentId}
          mode="all"
          caseCount={cases.length}
          onConfirm={handleRunAllConfirm}
        />
      )}
    </div>
  );
}

function RunHistoryItem({
  run,
  agentId,
  expanded,
  detail,
  loadingDetail,
  deletingRun,
  onToggle,
  onDelete,
  onBaselineChanged,
}: {
  run: EvalRunRow;
  agentId?: string;
  expanded: boolean;
  detail?: EvalRunDetail;
  loadingDetail: boolean;
  deletingRun: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onBaselineChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();
  const passRate =
    run.totalCases > 0
      ? `${run.passedAssertions}/${run.totalCases}`
      : "0/0";

  const handleToggleBaseline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const fn = run.isBaseline ? clearBaseline : setBaseline;
    await fn(run.id, () => {
      onBaselineChanged();
      if (agentId) {
        globalMutate(benchmarkTrendsKey(agentId));
        globalMutate(benchmarkModelsKey(agentId));
      }
    });
  };

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
          onClick={handleToggleBaseline}
          title={run.isBaseline ? "Remove baseline" : "Set as baseline"}
        >
          <BookmarkIcon
            className={`size-3 ${run.isBaseline ? "fill-primary text-primary" : ""}`}
          />
        </Button>
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
