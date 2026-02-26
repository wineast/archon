"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  useEvalCases,
  useEvalBatches,
  deleteEvalBatch,
  fetchEvalBatchDetail,
  fetchEvalRunDetail,
} from "@/lib/eval/hooks";
import { useTemplateVars } from "@/lib/eval/template-vars-hooks";
import { useEvalBatch } from "@/lib/eval/eval-run-context";
import { useTools } from "@/lib/tools/hooks";
import { toEvalCase, toEvalResult } from "@/lib/eval/types";
import type {
  CreateEvalBatchResponse,
  EvalBatchDetail,
  EvalRunDetail,
  AssertionFailConfig,
  Dimension,
} from "@/lib/eval/types";
import type { EvalBatchRow, EvalRunRow } from "@/db/schema";
import { getScoreMax } from "@/lib/eval/judge-dimensions";
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
  RepeatIcon,
  ExternalLinkIcon,
} from "lucide-react";
import {
  benchmarkTrendsKey,
  benchmarkModelsKey,
} from "@/lib/eval/benchmark-hooks";
import { useSWRConfig } from "swr";
import { usePathname } from "next/navigation";

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

  const { batches, mutate: mutateBatches } = useEvalBatches(agentId);
  const {
    isRunning,
    activeBatch,
    progress,
    cancelBatch,
  } = useEvalBatch();

  const pathname = usePathname();
  const reportBaseUrl = pathname.replace(/\/build.*$/, "/eval");

  const [runDialogOpen, setRunDialogOpen] = useState(false);

  // Batch detail expansion
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchDetailCache, setBatchDetailCache] = useState<
    Record<string, EvalBatchDetail>
  >({});
  const [runDetailCache, setRunDetailCache] = useState<
    Record<string, EvalRunDetail>
  >({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  const allCases = caseRows.map(toEvalCase);
  const cases =
    selectedTags.length > 0
      ? allCases.filter((c) => selectedTags.some((t) => c.tags?.includes(t)))
      : allCases;

  const canRun = cases.length > 0;

  // Auto-expand running batch
  useEffect(() => {
    if (activeBatch) {
      setExpandedBatchId(activeBatch.id);
    }
  }, [activeBatch?.id]);

  // Auto-refresh detail for running/expanded batch
  useEffect(() => {
    if (!expandedBatchId) return;
    const batch = batches.find((b) => b.id === expandedBatchId);
    if (batch?.status !== "running") return;

    const interval = setInterval(async () => {
      const detail = await fetchEvalBatchDetail(expandedBatchId);
      if (detail) {
        setBatchDetailCache((prev) => ({ ...prev, [expandedBatchId]: detail }));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [expandedBatchId, batches]);

  const handleRunAllConfirm = useCallback(async (params: {
    judgeAgentId: string;
    assertionFailConfig: AssertionFailConfig;
    concurrency: number;
    repeatCount: number;
    runConcurrency: number;
  }) => {
    if (!agentId) return;
    const { judgeAgentId, assertionFailConfig, concurrency, repeatCount, runConcurrency } = params;

    setRunDialogOpen(false);

    try {
      const createRes = await fetch("/api/eval/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          judgeAgentId,
          filterTags: selectedTags.length > 0 ? selectedTags : undefined,
          assertionFailConfig: Object.keys(assertionFailConfig).length > 0 ? assertionFailConfig : undefined,
          concurrency,
          totalCases: cases.length,
          cases,
          templateVars,
          toolNames: getEnabledToolNames(),
          repeatCount,
          runConcurrency,
        }),
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => null);
        const errMsg = errData?.error || `HTTP ${createRes.status}`;
        throw new Error(errMsg);
      }
      const { batchId }: CreateEvalBatchResponse = await createRes.json();
      mutateBatches();
      setExpandedBatchId(batchId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [
    agentId,
    cases,
    templateVars,
    selectedTags,
    mutateBatches,
  ]);

  const handleToggleBatchDetail = useCallback(
    async (batchId: string) => {
      if (expandedBatchId === batchId) {
        setExpandedBatchId(null);
        return;
      }
      setExpandedBatchId(batchId);
      if (!batchDetailCache[batchId]) {
        setLoadingDetail(batchId);
        const detail = await fetchEvalBatchDetail(batchId);
        if (detail) {
          setBatchDetailCache((prev) => ({ ...prev, [batchId]: detail }));
        }
        setLoadingDetail(null);
      }
    },
    [expandedBatchId, batchDetailCache]
  );

  const handleDeleteBatch = useCallback(
    async (batchId: string) => {
      setDeletingBatchId(batchId);
      await deleteEvalBatch(batchId, mutateBatches);
      if (expandedBatchId === batchId) setExpandedBatchId(null);
      setBatchDetailCache((prev) => {
        const { [batchId]: _, ...rest } = prev;
        return rest;
      });
      setDeletingBatchId(null);
    },
    [mutateBatches, expandedBatchId]
  );

  const loadRunDetail = useCallback(
    async (runId: string) => {
      const detail = await fetchEvalRunDetail(runId);
      if (detail) {
        setRunDetailCache((prev) => ({ ...prev, [runId]: detail }));
      }
    },
    []
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
              onClick={cancelBatch}
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

        {isRunning && activeBatch && (
          <div className="space-y-1">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              Running {activeBatch.completedRuns}/{activeBatch.totalRuns}
              {activeBatch.repeatCount > 1 && ` runs (x${activeBatch.repeatCount})`}
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {/* Batch history */}
          {batches.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                History
              </h3>
              <div className="space-y-1">
                {batches.map((batch) => (
                  <BatchHistoryItem
                    key={batch.id}
                    batch={batch}
                    agentId={agentId}
                    expanded={expandedBatchId === batch.id}
                    batchDetail={batchDetailCache[batch.id]}
                    runDetailCache={runDetailCache}
                    loadingDetail={loadingDetail === batch.id}
                    deletingBatch={deletingBatchId === batch.id}
                    reportBaseUrl={reportBaseUrl}
                    onToggle={() => handleToggleBatchDetail(batch.id)}
                    onDelete={() => handleDeleteBatch(batch.id)}
                    onBaselineChanged={mutateBatches}
                    onLoadRunDetail={loadRunDetail}
                  />
                ))}
              </div>
            </div>
          )}

          {!isRunning && batches.length === 0 && (
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

// ── BatchHistoryItem ──

function BatchHistoryItem({
  batch,
  agentId,
  expanded,
  batchDetail,
  runDetailCache,
  loadingDetail,
  deletingBatch,
  reportBaseUrl,
  onToggle,
  onDelete,
  onBaselineChanged,
  onLoadRunDetail,
}: {
  batch: EvalBatchRow;
  agentId?: string;
  expanded: boolean;
  batchDetail?: EvalBatchDetail;
  runDetailCache: Record<string, EvalRunDetail>;
  loadingDetail: boolean;
  deletingBatch: boolean;
  reportBaseUrl: string;
  onToggle: () => void;
  onDelete: () => void;
  onBaselineChanged: () => void;
  onLoadRunDetail: (runId: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();
  const isRunning = batch.status === "running";
  const isMultiRun = batch.repeatCount > 1;

  const scoreMax = getScoreMax(
    (batch.judgeConfigSnapshot as { dimensions?: Dimension[] } | null)?.dimensions
  );

  const passRate =
    batch.totalCasesPerRun > 0
      ? `${batch.passedAssertions}/${isMultiRun ? batch.totalCasesPerRun * batch.repeatCount : batch.totalCasesPerRun}`
      : "0/0";

  const handleToggleBaseline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/eval/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBaseline: !batch.isBaseline }),
      });
      if (!res.ok) throw new Error(await res.text());
      onBaselineChanged();
      if (agentId) {
        globalMutate(benchmarkTrendsKey(agentId));
        globalMutate(benchmarkModelsKey(agentId));
      }
    } catch {
      toast.error("Failed to toggle baseline");
    }
  };

  function renderStatusBadge() {
    switch (batch.status) {
      case "running":
        return (
          <Badge variant="secondary" className="text-[10px]">
            Running {batch.completedRuns}/{batch.totalRuns}
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
          {new Date(batch.createdAt).toLocaleString()}
        </span>
        {isMultiRun && (
          <Badge variant="outline" className="text-[10px] gap-0.5" data-testid="batch-repeat-badge">
            <RepeatIcon className="size-2.5" />
            x{batch.repeatCount}
          </Badge>
        )}
        {renderStatusBadge()}
        <span className="shrink-0 text-muted-foreground">
          {batch.chatModel.split("/").pop()}
        </span>
        {!isRunning && (
          <>
            <span className="shrink-0 font-medium" data-testid="run-pass-rate">{passRate}</span>
            {batch.averageScore != null && (
              <span className="shrink-0 text-muted-foreground" data-testid="run-score">
                {batch.averageScore}/{scoreMax}
                {batch.scoreStdDev != null && isMultiRun && (
                  <span className="ml-0.5 text-[9px]">
                    ±{batch.scoreStdDev}
                  </span>
                )}
              </span>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          data-testid="btn-batch-report"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`${reportBaseUrl}/batch/${batch.id}`, "_blank");
          }}
          title="Open batch report"
          disabled={isRunning}
        >
          <ExternalLinkIcon className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleToggleBaseline}
          title={batch.isBaseline ? "Remove baseline" : "Set as baseline"}
          disabled={isRunning}
        >
          <BookmarkIcon
            className={`size-3 ${batch.isBaseline ? "fill-primary text-primary" : ""}`}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          disabled={deletingBatch || isRunning}
        >
          {deletingBatch ? (
            <Spinner className="size-3" />
          ) : (
            <Trash2Icon className="size-3" />
          )}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Eval Batch"
        description="Are you sure you want to delete this eval batch? This action cannot be undone."
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
          {batchDetail && (
            <BatchExpandedContent
              batch={batch}
              batchDetail={batchDetail}
              runDetailCache={runDetailCache}
              scoreMax={scoreMax}
              reportBaseUrl={reportBaseUrl}
              onLoadRunDetail={onLoadRunDetail}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Expanded content for a batch ──

function BatchExpandedContent({
  batch,
  batchDetail,
  runDetailCache,
  scoreMax,
  reportBaseUrl,
  onLoadRunDetail,
}: {
  batch: EvalBatchRow;
  batchDetail: EvalBatchDetail;
  runDetailCache: Record<string, EvalRunDetail>;
  scoreMax: number;
  reportBaseUrl: string;
  onLoadRunDetail: (runId: string) => void;
}) {
  const isMultiRun = batch.repeatCount > 1;
  const { runs } = batchDetail;
  const isRunning = batch.status === "running";

  // N=1: Show results directly (same as old single-run view)
  if (!isMultiRun) {
    const singleRun = runs[0];
    if (!singleRun) {
      if (isRunning) {
        return (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            Waiting for results...
          </div>
        );
      }
      return null;
    }

    return (
      <SingleRunResults
        run={singleRun}
        runDetail={runDetailCache[singleRun.id]}
        scoreMax={scoreMax}
        reportUrl={`${reportBaseUrl}/${singleRun.id}`}
        onLoad={() => onLoadRunDetail(singleRun.id)}
        isRunning={isRunning}
      />
    );
  }

  // N>1: Show aggregated stats + per-run list
  return (
    <div className="space-y-3">
      {/* Aggregated stats */}
      {batch.status !== "running" && (
        <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1" data-testid="batch-aggregate-stats">
          <div className="font-medium text-muted-foreground">聚合统计 ({batch.repeatCount} 次)</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>Avg Pass Rate: <span className="font-medium" data-testid="batch-avg-pass-rate">{batch.passedAssertions}/{batch.totalCasesPerRun * batch.repeatCount}</span></div>
            {batch.averageScore != null && (
              <div>Avg Score: <span className="font-medium" data-testid="batch-avg-score">{batch.averageScore}/{scoreMax}</span></div>
            )}
            {batch.scoreStdDev != null && (
              <div>Std Dev: <span className="font-medium" data-testid="batch-std-dev">{batch.scoreStdDev}</span></div>
            )}
            {batch.minScore != null && batch.maxScore != null && (
              <div>Range: <span className="font-medium" data-testid="batch-score-range">{batch.minScore} ~ {batch.maxScore}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Per-run list */}
      <div className="space-y-1">
        {runs.map((run) => (
          <RunInBatchItem
            key={run.id}
            run={run}
            runDetail={runDetailCache[run.id]}
            scoreMax={scoreMax}
            reportUrl={`${reportBaseUrl}/${run.id}`}
            onLoad={() => onLoadRunDetail(run.id)}
          />
        ))}
      </div>

      {runs.length === 0 && isRunning && (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Spinner className="size-3" />
          Waiting for runs to start...
        </div>
      )}
    </div>
  );
}

// ── Single run results (for N=1 batch expanded view) ──

function SingleRunResults({
  run,
  runDetail,
  scoreMax,
  reportUrl,
  onLoad,
  isRunning,
}: {
  run: EvalRunRow;
  runDetail?: EvalRunDetail;
  scoreMax: number;
  reportUrl: string;
  onLoad: () => void;
  isRunning: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!runDetail && !loaded) {
      setLoaded(true);
      onLoad();
    }
  }, [runDetail, loaded, onLoad]);

  // Auto-refresh for running
  useEffect(() => {
    if (run.status !== "running") return;
    const interval = setInterval(() => onLoad(), 3000);
    return () => clearInterval(interval);
  }, [run.status, onLoad]);

  if (!runDetail) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Spinner className="size-3" />
        Loading details...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon-xs"
          data-testid="btn-eval-report"
          onClick={() => window.open(reportUrl, "_blank")}
          title="Open report"
        >
          <ExternalLinkIcon className="size-3" />
        </Button>
      </div>
      {runDetail.results.map((r) => (
        <ResultCard key={r.id} result={toEvalResult(r)} scoreMax={scoreMax} />
      ))}
      {runDetail.results.length === 0 && isRunning && (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Spinner className="size-3" />
          Waiting for results...
        </div>
      )}
    </div>
  );
}

// ── Individual run within a multi-run batch ──

function RunInBatchItem({
  run,
  runDetail,
  scoreMax,
  reportUrl,
  onLoad,
}: {
  run: EvalRunRow;
  runDetail?: EvalRunDetail;
  scoreMax: number;
  reportUrl: string;
  onLoad: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = run.status === "running";

  const passRate =
    run.totalCases > 0
      ? `${run.passedAssertions}/${run.totalCases}`
      : "0/0";

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !runDetail) {
      onLoad();
    }
  };

  // Auto-refresh for running
  useEffect(() => {
    if (!expanded || run.status !== "running") return;
    const interval = setInterval(() => onLoad(), 3000);
    return () => clearInterval(interval);
  }, [expanded, run.status, onLoad]);

  function renderRunStatus() {
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
      case "pending":
        return (
          <Badge variant="outline" className="text-[10px]">
            Pending
          </Badge>
        );
      default:
        return null;
    }
  }

  return (
    <div className="rounded border" data-testid="batch-run-item">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-accent cursor-pointer"
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        {expanded ? (
          <ChevronDownIcon className="size-2.5 shrink-0" />
        ) : (
          <ChevronRightIcon className="size-2.5 shrink-0" />
        )}
        <span className="font-medium">Run #{run.runIndex + 1}</span>
        {renderRunStatus()}
        <span className="flex-1" />
        {!isRunning && run.status !== "pending" && (
          <>
            <span className="font-medium">{passRate}</span>
            {run.averageScore != null && (
              <span className="text-muted-foreground">
                {run.averageScore}/{scoreMax}
              </span>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          data-testid="btn-eval-report"
          onClick={(e) => { e.stopPropagation(); window.open(reportUrl, "_blank"); }}
          title="Open report"
        >
          <ExternalLinkIcon className="size-2.5" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t px-2 py-2">
          {!runDetail ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              Loading...
            </div>
          ) : (
            <div className="space-y-3">
              {runDetail.results.map((r) => (
                <ResultCard key={r.id} result={toEvalResult(r)} scoreMax={scoreMax} />
              ))}
              {runDetail.results.length === 0 && isRunning && (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
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
