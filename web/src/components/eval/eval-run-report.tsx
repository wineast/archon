"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import useSWR from "swr";
import type { AgentRow } from "@/db/schema";
import type { EvalRunDetail, Dimension } from "@/lib/eval/types";
import { toEvalResult } from "@/lib/eval/types";
import { getScoreMax } from "@/lib/eval/judge-dimensions";
import { ResultCard } from "./result-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeftIcon } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface EvalRunReportProps {
  agent: AgentRow;
  runId: string;
  orgSlug: string;
}

export function EvalRunReport({ agent, runId, orgSlug }: EvalRunReportProps) {
  const [isRunningStatus, setIsRunningStatus] = useState(false);

  const { data, isLoading } = useSWR<EvalRunDetail>(
    `/api/eval/runs/${runId}`,
    fetcher,
    { refreshInterval: isRunningStatus ? 3000 : 0 }
  );

  useEffect(() => {
    setIsRunningStatus(data?.run?.status === "running");
  }, [data?.run?.status]);

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!data || !data.run || data.run.agentId !== agent.id) {
    return notFound();
  }

  const { run, results } = data;
  const isRunning = run.status === "running";
  const scoreMax = getScoreMax(
    (run.judgeConfigSnapshot as { dimensions?: Dimension[] } | null)?.dimensions
  );
  const passRate = run.totalCases > 0
    ? `${run.passedAssertions}/${run.totalCases}`
    : "0/0";
  const progress = run.totalCases > 0
    ? Math.round((run.completedCases / run.totalCases) * 100)
    : 0;

  return (
    <div className="flex h-svh flex-col" data-testid="eval-report-page">
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
        <span className="text-sm text-muted-foreground">Eval Report</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 border-b bg-muted/30 px-6 py-4 sm:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">Model</p>
          <p className="text-sm font-medium">{run.chatModel.split("/").pop()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Time</p>
          <p className="text-sm font-medium">{new Date(run.createdAt).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-0.5">{renderStatusBadge(run.status, run.completedCases, run.totalCases)}</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pass Rate</p>
          <p className="text-sm font-medium" data-testid="report-pass-rate">{passRate}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-sm font-medium" data-testid="report-score">
            {run.averageScore != null ? `${run.averageScore}/${scoreMax}` : "-"}
          </p>
        </div>
      </div>

      {/* Progress bar when running */}
      {isRunning && (
        <div className="px-6 py-2 border-b">
          <Progress value={progress} />
          <p className="mt-1 text-xs text-muted-foreground">
            Running {run.completedCases}/{run.totalCases}
          </p>
        </div>
      )}

      {/* Result cards */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-6 py-4">
          {results.map((r) => (
            <ResultCard key={r.id} result={toEvalResult(r)} scoreMax={scoreMax} />
          ))}
          {results.length === 0 && isRunning && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Waiting for results...
            </div>
          )}
          {results.length === 0 && !isRunning && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No results.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function renderStatusBadge(status: string, completedCases: number, totalCases: number) {
  switch (status) {
    case "running":
      return (
        <Badge variant="secondary" className="text-[10px]">
          Running {completedCases}/{totalCases}
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
