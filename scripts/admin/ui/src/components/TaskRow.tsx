import { useState } from "react";
import { Badge } from "./Badge";
import { Spinner } from "./Spinner";
import { moveTaskStatus } from "../api/client";
import type { Task } from "../types";

interface TaskRowProps {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}

// Next status transitions per (type, current status)
const TODO_NEXT: Record<string, { to: string; label: string; cls: string }[]> = {
  pending:  [{ to: "backlog", label: "排期", cls: "" }, { to: "cancelled", label: "取消", cls: "btn-danger" }],
  backlog:  [{ to: "ready", label: "就绪", cls: "btn-ready" }, { to: "cancelled", label: "取消", cls: "btn-danger" }],
  ready:    [{ to: "backlog", label: "退回", cls: "" }, { to: "cancelled", label: "取消", cls: "btn-danger" }],
};

const ISSUE_NEXT: Record<string, { to: string; label: string; cls: string }[]> = {
  open:     [{ to: "ready", label: "就绪", cls: "btn-ready" }, { to: "wontfix", label: "不修", cls: "btn-danger" }],
  ready:    [{ to: "open", label: "退回", cls: "" }, { to: "wontfix", label: "不修", cls: "btn-danger" }],
};

export function TaskRow({ task, expanded, onToggle, onRefresh }: TaskRowProps) {
  const [busy, setBusy] = useState("");

  const transitions = (task.type === "todo" ? TODO_NEXT : ISSUE_NEXT)[task.status] ?? [];

  const run = async (to: string) => {
    setBusy(to);
    try {
      await moveTaskStatus(task.type, task.id, to);
      onRefresh();
    } catch (e) {
      alert(`操作失败: ${e instanceof Error ? e.message : e}`);
    }
    setBusy("");
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <tr
      className={`task-row${expanded ? " task-row-expanded" : ""}`}
      onClick={onToggle}
      style={{ cursor: "pointer" }}
    >
      <td>
        <span className={`expand-icon${expanded ? " open" : ""}`}>&#x25B6;</span>
      </td>
      <td>
        <Badge variant={task.type === "todo" ? "todo" : "issue"}>
          {task.type === "todo" ? "Todo" : "Issue"}
        </Badge>
      </td>
      <td>
        <span className={`priority ${task.priority.toLowerCase()}`}>
          {task.priority}
        </span>
      </td>
      <td className="title-cell">
        <span className="title-text" title={task.title}>
          {task.title}
        </span>
        <div style={{ fontSize: "0.75em", color: "var(--text-muted)" }}>
          {task.id}
        </div>
      </td>
      <td>
        <Badge variant={task.status}>{task.status}</Badge>
      </td>
      <td>
        {task.worktree ? (
          <span className="wt-link">{task.worktree}</span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>-</span>
        )}
      </td>
      <td className="actions-cell" onClick={stop}>
        {transitions.length > 0 && (
          <div className="btn-group">
            {transitions.map((t) => (
              <button
                key={t.to}
                className={`btn btn-sm ${t.cls}`}
                disabled={!!busy}
                onClick={() => run(t.to)}
              >
                {busy === t.to && <Spinner />} {t.label}
              </button>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
