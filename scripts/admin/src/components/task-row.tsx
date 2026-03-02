"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { moveTaskStatus } from "@/lib/api";
import type { Task } from "@/lib/types";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskRowProps {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}

const TODO_NEXT: Record<
  string,
  { to: string; label: string; variant: "outline" | "ready" | "danger" }[]
> = {
  pending: [
    { to: "backlog", label: "排期", variant: "outline" },
    { to: "cancelled", label: "取消", variant: "danger" },
  ],
  backlog: [
    { to: "ready", label: "就绪", variant: "ready" },
    { to: "pending", label: "退回", variant: "outline" },
    { to: "cancelled", label: "取消", variant: "danger" },
  ],
  ready: [
    { to: "backlog", label: "退回", variant: "outline" },
    { to: "cancelled", label: "取消", variant: "danger" },
  ],
  cancelled: [{ to: "pending", label: "退回", variant: "outline" }],
};

const ISSUE_NEXT: Record<
  string,
  { to: string; label: string; variant: "outline" | "ready" | "danger" }[]
> = {
  open: [
    { to: "ready", label: "就绪", variant: "ready" },
    { to: "wontfix", label: "不修", variant: "danger" },
  ],
  ready: [
    { to: "open", label: "退回", variant: "outline" },
    { to: "wontfix", label: "不修", variant: "danger" },
  ],
  wontfix: [{ to: "open", label: "退回", variant: "outline" }],
};

export function TaskRow({
  task,
  expanded,
  onToggle,
  onRefresh,
}: TaskRowProps) {
  const [busy, setBusy] = useState("");

  const transitions =
    (task.type === "todo" ? TODO_NEXT : ISSUE_NEXT)[task.status] ?? [];

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
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/50",
        expanded && "bg-accent"
      )}
      onClick={onToggle}
    >
      <td className="w-[30px] py-2 pl-3 pr-0">
        <ChevronRightIcon
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            expanded && "rotate-90 text-primary"
          )}
        />
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "badge inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase",
            task.type === "todo" ? "badge-todo" : "badge-issue"
          )}
        >
          {task.type === "todo" ? "Todo" : "Issue"}
        </span>
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "font-mono text-[11px] font-bold",
            `priority-${task.priority.toLowerCase()}`
          )}
        >
          {task.priority}
        </span>
      </td>
      <td className="max-w-[400px] px-3 py-2">
        <span
          className="block truncate text-[13px] font-medium text-foreground"
          title={task.title}
        >
          {task.title}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.75em] text-muted-foreground">{task.id}</span>
          {task.tags?.length > 0 &&
            task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-sm bg-secondary px-1.5 py-px text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "badge inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase",
            `badge-${task.status}`
          )}
        >
          {task.status}
        </span>
      </td>
      <td className="px-3 py-2">
        {task.worktree ? (
          <span className="font-mono text-xs font-medium text-primary">
            {task.worktree}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2" onClick={stop}>
        {transitions.length > 0 && (
          <div className="flex items-center gap-2">
            {transitions.map((t) => (
              <Button
                key={t.to}
                variant={t.variant}
                size="xs"
                disabled={!!busy}
                onClick={() => run(t.to)}
              >
                {busy === t.to && <Spinner className="size-3" />}{" "}
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
