import { useState, useCallback, useEffect, useRef } from "react";
import { useTerminal } from "../hooks/use-terminal";
import {
  fetchReportData,
  fetchReportStatus,
  fetchMergeCheck,
  fetchTaskDetail,
  openTerminal as apiOpenTerminal,
  gitAdd as apiGitAdd,
} from "../api/client";
import { ReportViewer } from "./ReportViewer";
import { BranchComparison } from "./BranchComparison";
import { Terminal } from "./Terminal";
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
  const [taskDetailHtml, setTaskDetailHtml] = useState("");
  const [terminalAlive, setTerminalAlive] = useState(task.hasTerminal ?? false);
  const terminal = useTerminal();
  const pollingRef = useRef(false);

  const hasWorktree = !!task.worktree;

  // Full initial load (with loading spinner)
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
    } catch {
      // ignore
    }
    pollingRef.current = false;
  }, [task.worktree, hasWorktree, mergeState]);

  // Polling interval
  useEffect(() => {
    if (!hasWorktree) return;
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll, hasWorktree]);

  useEffect(() => {
    setTerminalAlive(task.hasTerminal ?? false);
  }, [task.hasTerminal]);

  const handleOpenTerminal = async () => {
    const skill = task.type === "todo" ? "/req-chain" : "/defect-chain";
    try {
      await apiOpenTerminal(task.worktree!, skill);
      setTerminalAlive(true);
      onRefresh();
    } catch (e) {
      console.error("[admin] open-terminal failed:", e);
    }
  };

  const handleSync = async () => {
    setSyncState("running");
    const ok = await terminal.run(
      `/api/reports/${encodeURIComponent(task.worktree!)}/sync`
    );
    setSyncState(ok ? "success" : "failed");
    if (ok) poll();
  };

  const handleMerge = async () => {
    setMergeState("running");
    const ok = await terminal.run(
      `/api/reports/${encodeURIComponent(task.worktree!)}/merge`
    );
    setMergeState(ok ? "success" : "failed");
    if (ok) {
      poll();
      onRefresh();
    }
  };

  const handleGitAdd = async () => {
    setAddState("running");
    try {
      await apiGitAdd(task.worktree!);
      setAddState("success");
      poll();
    } catch {
      setAddState("failed");
    }
  };

  const isCompleted = ["done", "closed", "cancelled", "wontfix"].includes(task.status);

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
            <div className="expanded-section-title">报告</div>
            {!isCompleted && (
              <button className="btn btn-sm" onClick={handleOpenTerminal}>
                {terminalAlive ? "激活终端" : "打开终端"}
              </button>
            )}
          </div>
          <ReportViewer
            reportData={reportData}
            worktreeName={task.worktree!}
          />
          <Terminal
            visible={terminal.visible}
            lines={terminal.lines}
            onClose={terminal.close}
          />
        </div>
      )}

      {/* ── 分支对比 ── */}
      {hasWorktree && statusData && mergeCheckData && (
        <div className="expanded-section">
          <div className="expanded-section-title">分支对比</div>
          <BranchComparison
            statusData={statusData}
            mergeCheckData={mergeCheckData}
            onSync={handleSync}
            onMerge={handleMerge}
            onGitAdd={handleGitAdd}
            syncState={syncState}
            mergeState={mergeState}
            addState={addState}
          />
        </div>
      )}
    </div>
  );
}
