"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { fetchTasksData } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Pagination } from "./pagination";
import { TaskRow } from "./task-row";
import { TaskExpanded } from "./task-expanded";
import { MermaidChart } from "./mermaid-chart";
import type { Task, TasksData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RefreshCwIcon, HelpCircleIcon } from "lucide-react";

const PAGE_SIZE = 30;

// ── URL query helpers ──

function getQuery() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function setQuery(params: Record<string, string>) {
  const q = getQuery();
  for (const [k, v] of Object.entries(params)) {
    if (!v || v === "all") q.delete(k);
    else q.set(k, v);
  }
  const qs = q.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  history.replaceState(null, "", url);
}

const STATUS_ORDER: Record<string, number> = {
  running: 0,
  ready: 1,
  open: 2,
  pending: 3,
  backlog: 4,
  merged: 5,
  cancelled: 6,
  wontfix: 6,
};

export function TasksPanel() {
  const [data, setData] = useState<TasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(
    () => getQuery().get("tab") || "all"
  );
  const [currentFilter, setCurrentFilter] = useState(
    () => getQuery().get("priority") || "all"
  );
  const [statusFilter, setStatusFilter] = useState(
    () => getQuery().get("status") || "all"
  );
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const raw = getQuery().get("expanded");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  });
  const [helpOpen, setHelpOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await fetchTasksData();
      setData(d);

      const runningIds = new Set(
        d.tasks
          .filter((t) => t.status === "ready" && t.worktree)
          .map((t) => t.id)
      );
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of runningIds) next.add(id);
        return next;
      });
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setQuery({ expanded: [...expandedIds].join(",") });
  }, [expandedIds]);

  const stats = data?.stats;

  const tabs = useMemo(() => {
    if (!data) return [];
    const s = data.stats;
    return [
      { id: "all", label: "全部", count: s.total },
      { id: "todo", label: "Todo", count: s.todoCount },
      { id: "issues", label: "Issue", count: s.issueCount },
      { id: "active", label: "进行中", count: s.active },
    ];
  }, [data]);

  const TODO_STATUSES = [
    "pending",
    "backlog",
    "ready",
    "merged",
    "cancelled",
  ];
  const ISSUE_STATUSES = ["open", "ready", "merged", "wontfix"];
  const ALL_STATUSES = [...new Set([...TODO_STATUSES, ...ISSUE_STATUSES])];

  const statusOptions = useMemo(() => {
    if (currentTab === "todo") return TODO_STATUSES;
    if (currentTab === "issues") return ISSUE_STATUSES;
    return ALL_STATUSES;
  }, [currentTab]);

  const allFilteredTasks = useMemo(() => {
    if (!data) return [];
    let tasks = data.tasks.slice();
    if (currentTab === "todo")
      tasks = tasks.filter((t) => t.type === "todo");
    else if (currentTab === "issues")
      tasks = tasks.filter((t) => t.type === "issue");
    else if (currentTab === "active")
      tasks = tasks.filter((t) => t.status === "ready" && t.worktree);

    if (currentFilter !== "all") {
      tasks = tasks.filter((t) => t.priority === currentFilter);
    }

    if (statusFilter !== "all") {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }

    tasks.sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 3;
      const sb = STATUS_ORDER[b.status] ?? 3;
      if (sa !== sb) return sa - sb;
      return a.priority.localeCompare(b.priority);
    });

    return tasks;
  }, [data, currentTab, currentFilter, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(allFilteredTasks.length / PAGE_SIZE)
  );
  const filteredTasks = allFilteredTasks.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-9 py-7">
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-[1200px] px-9 py-7">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Archon Admin
          </h1>
          <div className="mb-6 text-sm text-muted-foreground">
            任务: {stats!.total} &middot; 进行中: {stats!.active} &middot;
            就绪: {stats!.ready}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={helpOpen ? "default" : "outline"}
            size="icon-xs"
            onClick={() => setHelpOpen((v) => !v)}
            title="Help"
          >
            <HelpCircleIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={refresh}
            title="Refresh"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Help Panel */}
      {helpOpen && (
        <div className="mb-5 grid gap-4 rounded-lg border bg-muted p-5">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Todo 生命周期
            </div>
            <MermaidChart
              chart={`flowchart LR
  pending([PENDING]) -->|排期| backlog([BACKLOG])
  backlog -->|就绪| ready([READY])
  backlog -->|退回| pending
  ready -->|退回| backlog
  pending -->|取消| cancelled([CANCELLED])
  backlog -->|取消| cancelled
  ready -->|取消| cancelled
  cancelled -->|退回| pending
  ready -.->|post: 创建工作区 + 启动链路| ready
  merge((合并成功)) -.->|post: status→merged| merged([MERGED])
  merged -.->|/archive| archived([📦 releases/vN/])
  style merge fill:#6366f1,stroke:#4f46e5,color:#fff
  style archived fill:#f0fdf4,stroke:#86efac,color:#166534
  linkStyle 8,9 stroke:#e67e22,color:#e67e22`}
            />
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Issue 生命周期
            </div>
            <MermaidChart
              chart={`flowchart LR
  open([OPEN]) -->|就绪| ready([READY])
  ready -->|退回| open
  open -->|不修| wontfix([WONTFIX])
  ready -->|不修| wontfix
  wontfix -->|退回| open
  ready -.->|post: 创建工作区 + 启动链路| ready
  merge((合并成功)) -.->|post: status→merged| merged([MERGED])
  merged -.->|/archive| archived([📦 releases/vN/])
  style merge fill:#6366f1,stroke:#4f46e5,color:#fff
  style archived fill:#f0fdf4,stroke:#86efac,color:#166534
  linkStyle 5,6 stroke:#e67e22,color:#e67e22`}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
        {[
          { value: stats!.total, label: "总计" },
          { value: stats!.ready, label: "就绪" },
          { value: stats!.active, label: "进行中" },
          { value: stats!.completed, label: "已完成" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border p-4 shadow-xs transition-shadow hover:shadow-sm"
          >
            <div className="font-serif text-3xl font-bold leading-none">
              {s.value}
            </div>
            <div className="mt-1.5 text-[0.7em] font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={cn(
              "cursor-pointer border-b-2 border-transparent px-4 py-2.5 text-[13px] font-medium text-muted-foreground transition-all hover:text-foreground",
              currentTab === t.id &&
                "border-primary font-semibold text-primary"
            )}
            onClick={() => {
              setCurrentTab(t.id);
              setStatusFilter("all");
              setPage(1);
              setQuery({ tab: t.id, status: "" });
            }}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "ml-1.5 rounded-full bg-secondary px-2 py-px text-[0.85em] font-semibold text-muted-foreground",
                currentTab === t.id && "bg-accent text-primary"
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Priority filter */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <label className="mr-1 text-xs font-medium text-muted-foreground">
          优先级:
        </label>
        {["all", "P0", "P1", "P2", "P3"].map((f) => (
          <button
            key={f}
            className={cn(
              "cursor-pointer rounded-xl border px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:text-foreground",
              currentFilter === f &&
                "border-primary bg-accent text-primary"
            )}
            onClick={() => {
              setCurrentFilter(f);
              setPage(1);
              setQuery({ priority: f });
            }}
          >
            {f === "all" ? "全部" : f}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <label className="mr-1 text-xs font-medium text-muted-foreground">
          状态:
        </label>
        {["all", ...statusOptions].map((f) => (
          <button
            key={f}
            className={cn(
              "cursor-pointer rounded-xl border px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:text-foreground",
              statusFilter === f &&
                "border-primary bg-accent text-primary"
            )}
            onClick={() => {
              setStatusFilter(f);
              setPage(1);
              setQuery({ status: f });
            }}
          >
            {f === "all" ? "全部" : f}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div>
        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <div className="mb-3 text-2xl opacity-40">
              &#x1F4CB;
            </div>
            暂无任务
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="w-[30px] border-b bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                <th className="border-b bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  类型
                </th>
                <th className="border-b bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  优先级
                </th>
                <th className="border-b bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  标题
                </th>
                <th className="border-b bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  状态
                </th>
                <th className="border-b bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  工作区
                </th>
                <th className="border-b bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <TaskRowWithExpanded
                  key={t.id}
                  task={t}
                  expanded={expandedIds.has(t.id)}
                  onToggle={() => toggleExpand(t.id)}
                  onRefresh={refresh}
                />
              ))}
            </tbody>
          </table>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={allFilteredTasks.length}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}

function TaskRowWithExpanded({
  task,
  expanded,
  onToggle,
  onRefresh,
}: {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <TaskRow
        task={task}
        expanded={expanded}
        onToggle={onToggle}
        onRefresh={onRefresh}
      />
      {expanded && (
        <tr>
          <td
            colSpan={7}
            className="border-b-2 border-primary bg-muted p-0"
          >
            <TaskExpanded task={task} onRefresh={onRefresh} />
          </td>
        </tr>
      )}
    </>
  );
}
