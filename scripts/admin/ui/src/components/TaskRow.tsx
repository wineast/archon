import { Badge } from "./Badge";
import type { Task } from "../types";

function esc(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderChain(chain?: Record<string, boolean>): string {
  if (!chain) return "";
  return Object.entries(chain)
    .map(([k, present]) => {
      const label = k.replace(/\.md$/, "");
      const cls = present ? "present" : "missing";
      const mark = present ? " \u2713" : " \u2717";
      return `<span class="chain-dot ${cls}" title="${esc(label + mark)}"></span>`;
    })
    .join("");
}

interface TaskRowProps {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
}

export function TaskRow({ task, expanded, onToggle }: TaskRowProps) {
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
      <td>
        <div
          className="chain-dots"
          dangerouslySetInnerHTML={{ __html: renderChain(task.chain) }}
        />
      </td>
    </tr>
  );
}
