import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchReportData,
  fetchReportStatus,
  fetchMergeCheck,
  fetchTaskDetail,
  openTerminal as apiOpenTerminal,
  gitAdd as apiGitAdd,
  syncWorktree as apiSync,
  mergeWorktree as apiMerge,
} from "../api/client";
import { ReportViewer } from "./ReportViewer";
import { BranchComparison } from "./BranchComparison";
import { Spinner } from "./Spinner";
import type { Task, ReportData, StatusData, MergeCheckData } from "../types";
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
  const [mergeCheckData, setMergeCheckData] = useState<MergeCheckData | null>(null);
  const [mergeState, setMergeState] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [syncState, setSyncState] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [addState, setAddState] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [taskDetailHtml, setTaskDetailHtml] = useState("");
  const [terminals, setTerminals] = useState<string[]>(task.terminals ?? []);
  const pollingRef = useRef(false);
  const [lastPoll, setLastPoll] = useState<string>("");

  const hasWorktree = !!task.worktree;
  const isCompleted = ["done", "closed", "merged", "cancelled", "wontfix"].includes(task.status);

  // Full initial load (with loading spinner)
  const loadData = useCallback(async () => {
    setLoading(true);
    if (hasWorktree) {
      try {
        const fetches: Promise<any>[] = [fetchReportData(task.worktree!)];
        if (!isCompleted) {
          fetches.push(fetchReportStatus(task.worktree!), fetchMergeCheck(task.worktree!));
        }
        const results = await Promise.all(fetches);
        setReportData(results[0]);
        if (!isCompleted) {
          setStatusData(results[1]);
          setMergeCheckData(results[2]);
        }
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
  }, [task.worktree, task.path, hasWorktree, isCompleted]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lightweight poll — refresh report + git status without loading spinner
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
      setLastPoll(new Date().toLocaleTimeString());
    } catch {
      // ignore
    }
    pollingRef.current = false;
  }, [task.worktree, hasWorktree, mergeState]);

  // Polling interval (skip for completed tasks)
  useEffect(() => {
    if (!hasWorktree || isCompleted) return;
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll, hasWorktree, isCompleted]);

  useEffect(() => {
    setTerminals(task.terminals ?? []);
  }, [task.terminals]);

  const chainSkill = task.type === "todo" ? "/req-chain" : "/defect-chain";

  const handleOpenTerminal = async () => {
    try {
      await apiOpenTerminal(task.worktree!, chainSkill);
      setTerminals((prev) => prev.includes(chainSkill) ? prev : [...prev, chainSkill]);
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
    } catch (e: any) {
      setSyncState("failed");
      setErrorMsg(e.message);
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
    } catch (e: any) {
      setMergeState("failed");
      setErrorMsg(e.message);
    }
  };

  const handleGitAdd = async () => {
    setAddState("running");
    setErrorMsg("");
    try {
      await apiGitAdd(task.worktree!);
      setAddState("success");
      poll();
    } catch (e: any) {
      setAddState("failed");
      setErrorMsg(e.message);
    }
  };

  const handleCommit = async () => {
    try {
      await apiOpenTerminal(task.worktree!, "/commit");
      setTerminals((prev) => prev.includes("/commit") ? prev : [...prev, "/commit"]);
      onRefresh();
    } catch (e) {
      console.error("[admin] commit terminal failed:", e);
    }
  };

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

  const isPolling = hasWorktree && !isCompleted;

  const pollBadge = isPolling && lastPoll ? (
    <div className="poll-indicator">
      <span className="poll-dot" />
      <span>{lastPoll}</span>
    </div>
  ) : null;

  return (
    <div className="task-expanded">
      {/* ── 任务详情 ── */}
      {taskDetailHtml && (
        <div className="expanded-section">
          <div className="expanded-section-title">任务详情</div>
          <div
            className="md-content task-detail-content"
            dangerouslySetInnerHTML={{ __html: taskDetailHtml }}
          />
        </div>
      )}

      {/* ── 报告 ── */}
      {hasWorktree && reportData && (
        <div className="expanded-section">
          <div className="expanded-section-header">
            <div className="expanded-section-title">报告{pollBadge}</div>
            {!isCompleted && (
              <button className="btn btn-sm" onClick={handleOpenTerminal}>
                {terminals.includes(chainSkill) ? "✦ 生成报告中…" : "✦ 生成报告"}
              </button>
            )}
          </div>
          <ReportViewer
            reportData={reportData}
            worktreeName={task.worktree!}
          />
        </div>
      )}

      {/* ── 分支对比（已完成不显示） ── */}
      {hasWorktree && !isCompleted && statusData && mergeCheckData && (
        <div className="expanded-section">
          <div className="expanded-section-header">
            <div className="expanded-section-title">分支对比{pollBadge}</div>
          </div>
          <BranchComparison
            worktreeName={task.worktree!}
            statusData={statusData}
            mergeCheckData={mergeCheckData}
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
            <div className="error-banner" onClick={() => setErrorMsg("")}>
              {errorMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
