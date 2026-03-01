"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchReportData,
  fetchReportStatus,
  fetchMergeCheck,
  fetchTaskDetail,
  openTerminal as apiOpenTerminal,
  checkTerminal as apiCheckTerminal,
  gitAdd as apiGitAdd,
  syncWorktree as apiSync,
  mergeWorktree as apiMerge,
} from "@/lib/api";
import { ReportViewer } from "./report-viewer";
import { ReviewPanel } from "./review-panel";
import { BranchComparison } from "./branch-comparison";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import type { Task, ReportData, StatusData, MergeCheckData } from "@/lib/types";
import { marked } from "marked";

const POLL_INTERVAL = 3000;

interface TaskExpandedProps {
  task: Task;
  onRefresh: () => void;
}

export function TaskExpanded({ task, onRefresh }: TaskExpandedProps) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [mergeCheckData, setMergeCheckData] = useState<MergeCheckData | null>(
    null
  );
  const [mergeState, setMergeState] = useState<
    "idle" | "running" | "success" | "failed"
  >("idle");
  const [syncState, setSyncState] = useState<
    "idle" | "running" | "success" | "failed"
  >("idle");
  const [addState, setAddState] = useState<
    "idle" | "running" | "success" | "failed"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [taskDetailHtml, setTaskDetailHtml] = useState("");
  const [terminals, setTerminals] = useState<string[]>(
    task.terminals ?? []
  );
  const terminalsRef = useRef(terminals);
  terminalsRef.current = terminals;
  const pollingRef = useRef(false);
  const [lastPoll, setLastPoll] = useState<string>("");

  const hasWorktree = !!task.worktree;
  const isCompleted = [
    "done",
    "closed",
    "merged",
    "cancelled",
    "wontfix",
  ].includes(task.status);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (hasWorktree) {
      try {
        const [rd, sd, mc] = await Promise.all([
          fetchReportData(task.worktree!),
          fetchReportStatus(task.worktree!).catch(() => null),
          task.status === "merged"
            ? ({ status: "merged", message: "已合并" } as MergeCheckData)
            : isCompleted
              ? null
              : fetchMergeCheck(task.worktree!).catch(() => null),
        ]);
        setReportData(rd);
        if (sd) setStatusData(sd);
        if (mc) setMergeCheckData(mc);
      } catch {
        // ignore
      }
    }
    try {
      const d = await fetchTaskDetail(task.path);
      let text = d.content || "";
      text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      if (text) {
        setTaskDetailHtml(marked.parse(text) as string);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [task.worktree, task.path, hasWorktree, isCompleted, task.status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const poll = useCallback(async () => {
    if (!hasWorktree || pollingRef.current) return;
    pollingRef.current = true;
    try {
      const [rd, sd, mc] = await Promise.all([
        fetchReportData(task.worktree!),
        fetchReportStatus(task.worktree!),
        mergeState === "success"
          ? ({ status: "merged", message: "已合并" } as MergeCheckData)
          : fetchMergeCheck(task.worktree!),
      ]);
      setReportData(rd);
      setStatusData(sd);
      setMergeCheckData(mc);

      // Verify terminals still alive
      const cur = terminalsRef.current;
      if (cur.length > 0) {
        const checks = await Promise.all(
          cur.map(async (skill) => {
            try {
              const { exists } = await apiCheckTerminal(
                `${task.worktree}::${skill}`
              );
              return exists ? skill : null;
            } catch {
              return skill; // keep on error
            }
          })
        );
        const alive = checks.filter(Boolean) as string[];
        if (alive.length !== cur.length) {
          setTerminals(alive);
        }
      }

      setLastPoll(new Date().toLocaleTimeString());
    } catch {
      // ignore
    }
    pollingRef.current = false;
  }, [task.worktree, hasWorktree, mergeState]);

  useEffect(() => {
    if (!hasWorktree || isCompleted) return;
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll, hasWorktree, isCompleted]);

  useEffect(() => {
    setTerminals(task.terminals ?? []);
  }, [task.terminals]);

  const chainSkill =
    task.type === "todo" ? "/req-chain" : "/defect-chain";
  const reviewSkill =
    task.type === "todo" ? "/review-req" : "/review-defect";

  const handleOpenTerminal = async () => {
    try {
      await apiOpenTerminal(task.worktree!, chainSkill);
      setTerminals((prev) =>
        prev.includes(chainSkill) ? prev : [...prev, chainSkill]
      );
      onRefresh();
    } catch (e) {
      console.error("[admin] open-terminal failed:", e);
    }
  };

  const handleSync = async () => {
    setSyncState("running");
    setErrorMsg("");
    try {
      await apiSync(task.worktree!);
      setSyncState("success");
      poll();
    } catch (e: unknown) {
      setSyncState("failed");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleMerge = async () => {
    setMergeState("running");
    setErrorMsg("");
    try {
      await apiMerge(task.worktree!);
      setMergeState("success");
      poll();
      onRefresh();
    } catch (e: unknown) {
      setMergeState("failed");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleGitAdd = async () => {
    setAddState("running");
    setErrorMsg("");
    try {
      await apiGitAdd(task.worktree!);
      setAddState("success");
      poll();
    } catch (e: unknown) {
      setAddState("failed");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCommit = async () => {
    try {
      await apiOpenTerminal(task.worktree!, "/commit");
      setTerminals((prev) =>
        prev.includes("/commit") ? prev : [...prev, "/commit"]
      );
      onRefresh();
    } catch (e) {
      console.error("[admin] commit terminal failed:", e);
    }
  };

  const handleOpenReviewTerminal = async () => {
    try {
      await apiOpenTerminal(task.worktree!, reviewSkill);
      setTerminals((prev) =>
        prev.includes(reviewSkill) ? prev : [...prev, reviewSkill]
      );
      onRefresh();
    } catch (e) {
      console.error("[admin] review terminal failed:", e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  const isPolling = hasWorktree && !isCompleted;

  const pollBadge = isPolling && lastPoll && (
    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
      <span
        className="size-1.5 rounded-full bg-primary"
        style={{ animation: "poll-pulse 3s ease-in-out infinite" }}
      />
      <span>{lastPoll}</span>
    </span>
  );

  return (
    <div className="space-y-5 p-5">
      {/* Task detail */}
      {taskDetailHtml && (
        <div>
          <div className="mb-3 border-b pb-1.5 text-[0.8rem] font-semibold uppercase tracking-wide text-muted-foreground">
            任务详情
          </div>
          <div
            className="md-content"
            dangerouslySetInnerHTML={{ __html: taskDetailHtml }}
          />
        </div>
      )}

      {/* Reports */}
      {hasWorktree && reportData && (
        <div>
          <div className="mb-3 flex items-center justify-between border-b pb-1.5">
            <div className="flex items-center text-[0.8rem] font-semibold uppercase tracking-wide text-muted-foreground">
              报告{pollBadge}
            </div>
            {!isCompleted && (
              <Button variant="outline" size="sm" onClick={handleOpenTerminal}>
                {terminals.includes(chainSkill)
                  ? "\u2726 生成报告中\u2026"
                  : "\u2726 生成报告"}
              </Button>
            )}
          </div>
          <ReportViewer
            reportData={reportData}
            worktreeName={task.worktree!}
          />
        </div>
      )}

      {/* Reviews */}
      {hasWorktree && reportData && (
        <div>
          <div className="mb-3 flex items-center justify-between border-b pb-1.5">
            <div className="flex items-center text-[0.8rem] font-semibold uppercase tracking-wide text-muted-foreground">
              评审{pollBadge}
            </div>
            {!isCompleted && (
              <Button variant="outline" size="sm" onClick={handleOpenReviewTerminal}>
                {terminals.includes(reviewSkill)
                  ? "\u2726 评审中\u2026"
                  : "\u2726 发起评审"}
              </Button>
            )}
          </div>
          <ReviewPanel
            reviews={reportData.reviews ?? []}
            worktreeName={task.worktree!}
          />
        </div>
      )}

      {/* Branch comparison */}
      {hasWorktree && statusData && mergeCheckData && (
        <div>
          <div className="mb-3 border-b pb-1.5">
            <div className="flex items-center text-[0.8rem] font-semibold uppercase tracking-wide text-muted-foreground">
              分支对比{pollBadge}
            </div>
          </div>
          <BranchComparison
            worktreeName={task.worktree!}
            statusData={statusData}
            mergeCheckData={mergeCheckData}
            readOnly={isCompleted}
            onSync={handleSync}
            onMerge={handleMerge}
            onGitAdd={handleGitAdd}
            onCommit={handleCommit}
            terminals={terminals}
            syncState={syncState}
            mergeState={mergeState}
            addState={addState}
          />
          {errorMsg && (
            <div
              className="mt-2 cursor-pointer whitespace-pre-wrap rounded-md border border-destructive bg-[#fef0ee] p-2 px-3 text-xs text-destructive"
              onClick={() => setErrorMsg("")}
            >
              {errorMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
