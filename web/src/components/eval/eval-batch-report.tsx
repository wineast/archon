"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import useSWR from "swr";
import type { AgentRow, EvalRunRow } from "@/db/schema";
import type { EvalBatchDetail, EvalRunDetail, Dimension } from "@/lib/eval/types";
import { toEvalResult } from "@/lib/eval/types";
import { getScoreMax } from "@/lib/eval/judge-dimensions";
import { ResultCard } from "./result-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { fetchEvalRunDetail } from "@/lib/eval/hooks";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface EvalBatchReportProps {
  agent: AgentRow;
  batchId: string;
  orgSlug: string;
}

export function EvalBatchReport({
  agent,
  batchId,
  orgSlug,
}: EvalBatchReportProps) {
  const [isRunningStatus, setIsRunningStatus] = useState(false);
  const [runDetailCache, setRunDetailCache] = useState<
    Record<string, EvalRunDetail>
  >({});

  const { data, isLoading } = useSWR<EvalBatchDetail>(
    `/api/eval/batches/${batchId}`,
    fetcher,
    { refreshInterval: isRunningStatus ? 3000 : 0 }
  );

  useEffect(() => {
    setIsRunningStatus(data?.batch?.status === "running");
  }, [data?.batch?.status]);

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!data || !data.batch || data.batch.agentId !== agent.id) {
    return notFound();
  }

  const { batch, runs } = data;
  const isRunning = batch.status === "running";
  const isMultiRun = batch.repeatCount > 1;
  const scoreMax = getScoreMax(
    (batch.judgeConfigSnapshot as { dimensions?: Dimension[] } | null)
      ?.dimensions
  );

  const totalCases = batch.totalCasesPerRun * batch.repeatCount;
  const passRate =
    totalCases > 0 ? `${batch.passedAssertions}/${totalCases}` : "0/0";

  const completedCases = runs.reduce((sum, r) => sum + r.completedCases, 0);
  const totalAllCases = runs.reduce((sum, r) => sum + r.totalCases, 0);
  const progress =
    totalAllCases > 0 ? Math.round((completedCases / totalAllCases) * 100) : 0;

  const loadRunDetail = async (runId: string) => {
    const detail = await fetchEvalRunDetail(runId);
    if (detail) {
      setRunDetailCache((prev) => ({ ...prev, [runId]: detail }));
    }
  };

  return (
    <div className="flex h-svh flex-col" data-testid="eval-batch-report-page">
      {/* Header */}
      <div className="flex h-12 items-center gap-3 border-b px-4">
        <Link
          href={`/${orgSlug}/${agent.slug}/build?tab=eval`}
          className="flex items-center text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <span className="text-sm font-medium">{agent.name}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Batch Report</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 border-b bg-muted/30 px-6 py-4 sm:grid-cols-6">
        <div>
          <p className="text-xs text-muted-foreground">Model</p>
          <p className="text-sm font-medium">
            {batch.chatModel.split("/").pop()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Time</p>
          <p className="text-sm font-medium">
            {new Date(batch.createdAt).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-0.5">
            {renderStatusBadge(batch.status, batch.completedRuns, batch.totalRuns)}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Repeat</p>
          <p className="text-sm font-medium" data-testid="report-repeat-count">
            x{batch.repeatCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pass Rate</p>
          <p className="text-sm font-medium" data-testid="report-pass-rate">
            {passRate}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-sm font-medium" data-testid="report-score">
            {batch.averageScore != null ? (
              <>
                {batch.averageScore}/{scoreMax}
                {batch.scoreStdDev != null && isMultiRun && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    &plusmn;{batch.scoreStdDev}
                  </span>
                )}
              </>
            ) : (
              "-"
            )}
          </p>
        </div>
      </div>

      {/* Progress bar when running */}
      {isRunning && (
        <div className="border-b px-6 py-2">
          <Progress value={progress} />
          <p className="mt-1 text-xs text-muted-foreground">
            Running {batch.completedRuns}/{batch.totalRuns} runs
          </p>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-6 py-4">
          {isMultiRun ? (
            <MultiRunContent
              batch={batch}
              runs={runs}
              scoreMax={scoreMax}
              runDetailCache={runDetailCache}
              onLoadRunDetail={loadRunDetail}
              isRunning={isRunning}
            />
          ) : (
            <SingleRunContent
              run={runs[0]}
              scoreMax={scoreMax}
              runDetailCache={runDetailCache}
              onLoadRunDetail={loadRunDetail}
              isRunning={isRunning}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── N=1: Show single run results directly ──

function SingleRunContent({
  run,
  scoreMax,
  runDetailCache,
  onLoadRunDetail,
  isRunning,
}: {
  run?: EvalRunRow;
  scoreMax: number;
  runDetailCache: Record<string, EvalRunDetail>;
  onLoadRunDetail: (runId: string) => void;
  isRunning: boolean;
}) {
  const runDetail = run ? runDetailCache[run.id] : undefined;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (run && !runDetail && !loaded) {
      setLoaded(true);
      onLoadRunDetail(run.id);
    }
  }, [run, runDetail, loaded, onLoadRunDetail]);

  // Auto-refresh for running
  useEffect(() => {
    if (!run || run.status !== "running") return;
    const interval = setInterval(() => onLoadRunDetail(run.id), 3000);
    return () => clearInterval(interval);
  }, [run, run?.status, onLoadRunDetail]);

  if (!run) {
    if (isRunning) {
      return (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Waiting for results...
        </div>
      );
    }
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No results.
      </p>
    );
  }

  if (!runDetail) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading results...
      </div>
    );
  }

  return (
    <>
      {runDetail.results.map((r) => (
        <ResultCard key={r.id} result={toEvalResult(r)} scoreMax={scoreMax} />
      ))}
      {runDetail.results.length === 0 && isRunning && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Waiting for results...
        </div>
      )}
      {runDetail.results.length === 0 && !isRunning && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No results.
        </p>
      )}
    </>
  );
}

// ── N>1: Aggregated stats + per-run collapsible list ──

function MultiRunContent({
  batch,
  runs,
  scoreMax,
  runDetailCache,
  onLoadRunDetail,
  isRunning,
}: {
  batch: EvalBatchDetail["batch"];
  runs: EvalRunRow[];
  scoreMax: number;
  runDetailCache: Record<string, EvalRunDetail>;
  onLoadRunDetail: (runId: string) => void;
  isRunning: boolean;
}) {
  return (
    <>
      {/* Aggregated stats */}
      {!isRunning && (
        <div
          className="rounded-md bg-muted/50 p-4 text-sm space-y-2"
          data-testid="report-aggregate-stats"
        >
          <div className="font-medium text-muted-foreground">
            Aggregate ({batch.repeatCount} runs)
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Avg Pass Rate</p>
              <p className="font-medium">
                {batch.passedAssertions}/
                {batch.totalCasesPerRun * batch.repeatCount}
              </p>
            </div>
            {batch.averageScore != null && (
              <div>
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className="font-medium">
                  {batch.averageScore}/{scoreMax}
                </p>
              </div>
            )}
            {batch.scoreStdDev != null && (
              <div>
                <p className="text-xs text-muted-foreground">Std Dev</p>
                <p className="font-medium">{batch.scoreStdDev}</p>
              </div>
            )}
            {batch.minScore != null && batch.maxScore != null && (
              <div>
                <p className="text-xs text-muted-foreground">Range</p>
                <p className="font-medium">
                  {batch.minScore} ~ {batch.maxScore}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-run list */}
      <div className="space-y-2">
        {runs.map((run) => (
          <CollapsibleRunItem
            key={run.id}
            run={run}
            runDetail={runDetailCache[run.id]}
            scoreMax={scoreMax}
            onLoad={() => onLoadRunDetail(run.id)}
          />
        ))}
      </div>

      {runs.length === 0 && isRunning && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Waiting for runs to start...
        </div>
      )}
    </>
  );
}

// ── Collapsible per-run item for N>1 ──

function CollapsibleRunItem({
  run,
  runDetail,
  scoreMax,
  onLoad,
}: {
  run: EvalRunRow;
  runDetail?: EvalRunDetail;
  scoreMax: number;
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

  return (
    <div className="rounded-md border">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent cursor-pointer"
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        {expanded ? (
          <ChevronDownIcon className="size-3.5 shrink-0" />
        ) : (
          <ChevronRightIcon className="size-3.5 shrink-0" />
        )}
        <span className="font-medium">Run #{run.runIndex + 1}</span>
        {renderRunStatus(run)}
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
      </div>
      {expanded && (
        <div className="border-t px-4 py-3">
          {!runDetail ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading...
            </div>
          ) : (
            <div className="space-y-3">
              {runDetail.results.map((r) => (
                <ResultCard
                  key={r.id}
                  result={toEvalResult(r)}
                  scoreMax={scoreMax}
                />
              ))}
              {runDetail.results.length === 0 && isRunning && (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
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

// ── Shared badge renderers ──

function renderStatusBadge(
  status: string,
  completedRuns: number,
  totalRuns: number
) {
  switch (status) {
    case "running":
      return (
        <Badge variant="secondary" className="text-[10px]">
          Running {completedRuns}/{totalRuns}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="border-amber-500 text-amber-600 text-[10px] dark:text-amber-400"
        >
          Cancelled
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="text-[10px]">
          Failed
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="default" className="text-[10px]">
          Completed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          {status}
        </Badge>
      );
  }
}

function renderRunStatus(run: EvalRunRow) {
  switch (run.status) {
    case "running":
      return (
        <Badge variant="secondary" className="text-[10px]">
          Running {run.completedCases}/{run.totalCases}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="border-amber-500 text-amber-600 text-[10px] dark:text-amber-400"
        >
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
