import { useState, useCallback, useEffect, useMemo } from "react";
import { useTerminal } from "../hooks/use-terminal";
import {
  fetchReportData,
  fetchReportStatus,
  fetchMergeCheck,
  fetchTaskDetail,
  openTerminal as apiOpenTerminal,
  moveTaskStatus,
  dispatchTask,
  completeTask,
} from "../api/client";
import { ChainFlow } from "./ChainFlow";
import { StatusCards } from "./StatusCards";
import { ReportViewer } from "./ReportViewer";
import { Terminal } from "./Terminal";
import { Spinner } from "./Spinner";
import { Timeline, type TimelineStep } from "./Timeline";
import type { Task, ReportData, StatusData, MergeCheckData } from "../types";
import { marked } from "marked";

interface TaskExpandedProps {
  task: Task;
  onRefresh: () => void;
}

export function TaskExpanded({ task, onRefresh }: TaskExpandedProps) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [mergeCheckData, setMergeCheckData] = useState<MergeCheckData | null>(null);
  const [mergeState, setMergeState] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [syncState, setSyncState] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [verdictHtml, setVerdictHtml] = useState("");
  const [verdictClass, setVerdictClass] = useState("");
  const [taskDetailHtml, setTaskDetailHtml] = useState("");
  const terminal = useTerminal();

  const hasWorktree = !!task.worktree;

  const loadData = useCallback(async () => {
    setLoading(true);
    if (hasWorktree) {
      try {
        const [rd, sd, mc] = await Promise.all([
          fetchReportData(task.worktree!),
          fetchReportStatus(task.worktree!),
          fetchMergeCheck(task.worktree!),
        ]);
        setReportData(rd);
        setStatusData(sd);
        setMergeCheckData(mc);
      } catch {
        // ignore
      }
    }
    // Always load task detail for markdown display
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
  }, [task.worktree, task.path, hasWorktree]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshActions = useCallback(async () => {
    if (!hasWorktree) return;
    try {
      const sd = await fetchReportStatus(task.worktree!);
      setStatusData(sd);
    } catch {}
    try {
      if (mergeState === "success") {
        setMergeCheckData({ status: "merged", message: "已合并" });
      } else {
        const mc = await fetchMergeCheck(task.worktree!);
        setMergeCheckData(mc);
      }
    } catch {}
  }, [task.worktree, hasWorktree, mergeState]);

  // ── Action handlers ──

  const handleMarkReady = async () => {
    setReadyLoading(true);
    try {
      await moveTaskStatus(task.type, task.id, "ready");
      onRefresh();
    } catch (e) {
      console.error("[admin] mark-ready failed:", e);
      alert(`标为就绪失败: ${e instanceof Error ? e.message : e}`);
    }
    setReadyLoading(false);
  };

  const handleDispatch = async () => {
    setDispatchLoading(true);
    try {
      await dispatchTask(task.type, task.id);
      onRefresh();
    } catch (e) {
      console.error("[admin] dispatch failed:", e);
      alert(`派发失败: ${e instanceof Error ? e.message : e}`);
    }
    setDispatchLoading(false);
  };

  const handleOpenTerminal = () => {
    const skill = task.type === "todo" ? "/req-chain" : "/defect-chain";
    apiOpenTerminal(task.worktree!, skill);
  };

  const handleSync = async () => {
    setSyncState("running");
    const ok = await terminal.run(
      `/api/reports/${encodeURIComponent(task.worktree!)}/sync`
    );
    setSyncState(ok ? "success" : "failed");
    if (ok) refreshActions();
  };

  const handleMerge = async () => {
    setMergeState("running");
    const ok = await terminal.run(
      `/api/reports/${encodeURIComponent(task.worktree!)}/merge`
    );
    setMergeState(ok ? "success" : "failed");
    if (ok) {
      refreshActions();
      onRefresh();
    }
  };

  const handleComplete = async () => {
    setCompleteLoading(true);
    try {
      await completeTask(task.type, task.id);
      onRefresh();
    } catch (e) {
      console.error("[admin] complete failed:", e);
      alert(`完成失败: ${e instanceof Error ? e.message : e}`);
    }
    setCompleteLoading(false);
  };

  const handleReject = async () => {
    setRejectLoading(true);
    try {
      const to = task.type === "todo" ? "cancelled" : "wontfix";
      await moveTaskStatus(task.type, task.id, to);
      onRefresh();
    } catch (e) {
      console.error("[admin] reject failed:", e);
      alert(`操作失败: ${e instanceof Error ? e.message : e}`);
    }
    setRejectLoading(false);
  };

  const handleDeleteWorktree = async () => {
    if (!confirm(`确定删除工作区 "${task.worktree}"？`)) return;
    const ok = await terminal.run(
      `/api/worktrees/delete?name=${encodeURIComponent(task.worktree!)}`
    );
    if (ok) {
      try {
        await moveTaskStatus(task.type, task.id, "ready");
      } catch {}
    }
    onRefresh();
  };

  // ── Compute current step ──

  const isCompleted = ["done", "closed", "cancelled", "wontfix"].includes(task.status);
  const isMerged = mergeState === "success" || mergeCheckData?.status === "merged";

  // Chain completion: all chain nodes available
  const chainComplete = useMemo(() => {
    if (!reportData?.chain) return false;
    return reportData.chain.every((n) => n.available);
  }, [reportData]);

  const canMerge =
    mergeCheckData &&
    mergeState !== "success" &&
    mergeCheckData.status === "clean";

  const showSync = mergeCheckData && mergeCheckData.status === "behind";

  // Determine current phase
  type Phase = "ready" | "dispatch" | "chain" | "merge" | "complete";
  const currentPhase: Phase = useMemo(() => {
    if (isCompleted) return "complete";
    if (isMerged) return "complete";
    if (task.status === "running" && hasWorktree) {
      // If chain is complete and merge-check is clean/merged → merge phase
      if (chainComplete && (canMerge || isMerged)) return "merge";
      return "chain";
    }
    if (task.status === "ready") return "dispatch";
    return "ready";
  }, [task.status, hasWorktree, isCompleted, isMerged, chainComplete, canMerge]);

  const lastLabel = task.type === "todo" ? "完成" : "关闭";
  const rejectLabel = task.type === "todo" ? "取消" : "不修";

  const steps: TimelineStep[] = useMemo(() => {
    const phaseOrder: Phase[] = ["ready", "dispatch", "chain", "merge", "complete"];
    const currentIdx = phaseOrder.indexOf(currentPhase);

    const stepDefs: { phase: Phase; label: string; action?: TimelineStep["action"]; secondaryAction?: TimelineStep["secondaryAction"] }[] = [
      {
        phase: "ready",
        label: "就绪",
        action: { label: "标为就绪", help: "将任务标记为 ready，表示已评审、可以派发。", onClick: handleMarkReady, loading: readyLoading },
      },
      {
        phase: "dispatch",
        label: "派发",
        action: { label: "派发", help: "创建 Git 工作区，自动打开终端并启动链路技能。", onClick: handleDispatch, loading: dispatchLoading },
      },
      {
        phase: "chain",
        label: "链路",
        action: { label: "打开终端", help: "重新打开工作区终端，继续执行链路技能。", onClick: handleOpenTerminal },
      },
      {
        phase: "merge",
        label: "合并",
        action: showSync
          ? { label: "同步", help: "拉取上游最新变更到当前工作区。", onClick: handleSync, loading: syncState === "running" }
          : { label: "合并", help: "将工作区分支合并到 dev 分支。", onClick: handleMerge, loading: mergeState === "running" },
      },
      {
        phase: "complete",
        label: lastLabel,
        action: {
          label: "完成",
          help: task.type === "todo" ? "标记任务为 done。" : "标记缺陷为 closed。",
          onClick: handleComplete,
          loading: completeLoading,
        },
        secondaryAction: {
          label: rejectLabel,
          help: task.type === "todo" ? "标记为 cancelled，不再执行此任务。" : "标记为 wontfix，不予修复此缺陷。",
          onClick: handleReject,
          loading: rejectLoading,
          variant: "btn-danger",
        },
      },
    ];

    return stepDefs.map((def, i) => {
      let status: TimelineStep["status"];
      if (i < currentIdx) status = "done";
      else if (i === currentIdx) status = isCompleted ? "done" : "current";
      else status = "pending";

      return {
        label: def.label,
        status,
        action: def.action,
        secondaryAction: def.secondaryAction,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPhase, isCompleted, lastLabel, rejectLabel, readyLoading, dispatchLoading,
    completeLoading, rejectLoading, mergeState, syncState, showSync,
  ]);

  // ── Render ──

  if (loading) {
    return (
      <div className="task-expanded">
        <div className="empty-state" style={{ padding: "30px" }}>
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="task-expanded">
      {/* Timeline */}
      <Timeline steps={steps} />

      {/* Merge check info (only when in chain/merge phase with worktree) */}
      {hasWorktree && mergeCheckData && (currentPhase === "chain" || currentPhase === "merge") && (
        <MergeCheckBanner mergeCheckData={mergeCheckData} statusData={statusData} />
      )}

      {/* Chain Flow */}
      {hasWorktree && reportData && <ChainFlow chain={reportData.chain} />}

      {/* Verdict Banner */}
      {verdictHtml && (
        <div
          className={verdictClass}
          dangerouslySetInnerHTML={{ __html: verdictHtml }}
        />
      )}

      {/* Report Viewer */}
      {hasWorktree && reportData && (
        <ReportViewer
          reportData={reportData}
          worktreeName={task.worktree!}
          onVerdict={(html, cls) => {
            setVerdictHtml(html);
            setVerdictClass(cls);
          }}
        />
      )}

      {/* Status Cards */}
      {hasWorktree && statusData && <StatusCards data={statusData} />}

      {/* Task detail markdown (always show if available) */}
      {!hasWorktree && taskDetailHtml && (
        <div
          className="md-content task-detail-content"
          dangerouslySetInnerHTML={{ __html: taskDetailHtml }}
        />
      )}

      {/* Terminal */}
      <Terminal
        visible={terminal.visible}
        lines={terminal.lines}
        onClose={terminal.close}
      />

      {/* Delete worktree */}
      {hasWorktree && (
        <div className="expanded-footer">
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDeleteWorktree}
          >
            删除工作区
          </button>
        </div>
      )}
    </div>
  );
}

// ── MergeCheckBanner (extracted from WorkflowActions) ──

function MergeCheckBanner({
  mergeCheckData,
  statusData,
}: {
  mergeCheckData: MergeCheckData;
  statusData: StatusData | null;
}) {
  const isDirty = (s?: { staged: number; unstaged: number; untracked: number }) =>
    s ? s.staged > 0 || s.unstaged > 0 || s.untracked > 0 : false;

  const cls = (() => {
    const s = mergeCheckData.status;
    if (s === "clean" || s === "merged" || s === "up_to_date") return "merge-check clean";
    if (s === "conflict") return "merge-check conflict";
    if (s === "behind") return "merge-check behind";
    return "merge-check checking";
  })();

  const message = (() => {
    if (isDirty(statusData?.current)) return "\u26A0\uFE0F 当前工作区有未提交变更";
    if (isDirty(statusData?.upstream)) return "\u26A0\uFE0F 上游有未提交变更";
    if (mergeCheckData.status === "behind")
      return "\u26A0\uFE0F " + mergeCheckData.message + "，点击同步按钮拉取上游";
    if (mergeCheckData.status === "conflict")
      return "\u274C 检测到合并冲突，请执行 /resolve-conflicts 解决";
    return mergeCheckData.message || "";
  })();

  return <div className={cls}>{message}</div>;
}
