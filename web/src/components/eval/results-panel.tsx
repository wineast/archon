"use client";

import { Badge } from "@/components/ui/badge";
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
  CreateEvalRunResponse,
  EvalRunDetail,
  AssertionFailConfig,
} from "@/lib/eval/types";
import type { EvalRunRow } from "@/db/schema";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ResultCard } from "./result-card";
import { RunEvalDialog } from "./run-eval-dialog";
import {
  PlayIcon,
  SquareIcon,
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
    activeRun,
    progress,
    cancelRun,
  } = useEvalRun();

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

  // Auto-expand running run
  useEffect(() => {
    if (activeRun) {
      setExpandedRunId(activeRun.id);
    }
  }, [activeRun?.id]);

  // Auto-refresh detail for running/expanded run
  useEffect(() => {
    if (!expandedRunId) return;
    const run = runs.find((r) => r.id === expandedRunId);
    if (run?.status !== "running") return;

    const interval = setInterval(async () => {
      const detail = await fetchEvalRunDetail(expandedRunId);
      if (detail) {
        setRunDetailCache((prev) => ({ ...prev, [expandedRunId]: detail }));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [expandedRunId, runs]);

  const handleRunAllConfirm = useCallback(async (params: {
    judgeAgentId: string;
    assertionFailConfig: AssertionFailConfig;
  }) => {
    if (!agentId) return;
    const { judgeAgentId, assertionFailConfig } = params;

    setRunDialogOpen(false);

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
          cases,
          templateVars,
          toolNames: getEnabledToolNames(),
        }),
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => null);
        const errMsg = errData?.error || `HTTP ${createRes.status}`;
        throw new Error(errMsg);
      }
      const { runId }: CreateEvalRunResponse = await createRes.json();
      mutateRuns();
      // Auto-expand the new run
      setExpandedRunId(runId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [
    agentId,
    cases,
    templateVars,
    selectedTags,
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

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b px-4 py-3">
        {/* Run action */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={cancelRun}
            >
              <SquareIcon className="mr-1 size-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setRunDialogOpen(true)}
              disabled={!canRun}
              data-testid="btn-run-all"
            >
              <PlayIcon className="mr-1 size-3" />
              Run All ({cases.length})
            </Button>
          )}
          {selectedTags.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Filtered: {selectedTags.join(", ")}
            </span>
          )}
        </div>

        {isRunning && activeRun && (
          <div className="space-y-1">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              Running {activeRun.completedCases}/{activeRun.totalCases}
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {/* Run history */}
          {runs.length > 0 && (
            <div>
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

          {!isRunning && runs.length === 0 && (
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
  const isRunning = run.status === "running";

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

  function renderStatusBadge() {
    switch (run.status) {
      case "running":
        return (
          <Badge variant="secondary" className="text-[10px]">
            Running {run.completedCases}/{run.totalCases}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] dark:text-amber-400">
            Cancelled
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-[10px]">
            Failed
          </Badge>
        );
      default:
        return null;
    }
  }

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
        {renderStatusBadge()}
        <span className="shrink-0 text-muted-foreground">
          {run.chatModel.split("/").pop()}
        </span>
        {!isRunning && (
          <>
            <span className="shrink-0 font-medium" data-testid="run-pass-rate">{passRate}</span>
            {run.averageScore != null && (
              <span className="shrink-0 text-muted-foreground" data-testid="run-score">
                {run.averageScore}/10
              </span>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleToggleBaseline}
          title={run.isBaseline ? "Remove baseline" : "Set as baseline"}
          disabled={isRunning}
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
          disabled={deletingRun || isRunning}
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
              {detail.results.length === 0 && isRunning && (
                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                  <Spinner className="size-3" />
                  Waiting for results...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
