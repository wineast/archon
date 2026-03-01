import { useState, useCallback, useMemo } from "react";
import { fetchTasksData } from "../api/client";
import { Spinner } from "../components/Spinner";
import { Pagination } from "../components/Pagination";
import { TaskRow } from "../components/TaskRow";
import { TaskExpanded } from "../components/TaskExpanded";
import { Mermaid } from "../components/Mermaid";
import type { Task, TasksData } from "../types";

const PAGE_SIZE = 30;
const STATUS_ORDER: Record<string, number> = {
  running: 0,
  ready: 1,
  open: 2,
  pending: 3,
  backlog: 4,
  done: 5,
  closed: 6,
  cancelled: 7,
  wontfix: 7,
};

const ICON_HELP = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

export function TasksPanel() {
  const [data, setData] = useState<TasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("all");
  const [currentFilter, setCurrentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await fetchTasksData();
      setData(d);

      // Auto-expand running tasks
      const runningIds = new Set(
        d.tasks.filter((t) => t.status === "running").map((t) => t.id)
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

  // Initial load
  useState(() => {
    refresh();
  });

  const stats = data?.stats;

  const tabs = useMemo(() => {
    if (!data) return [];
    const s = data.stats;
    return [
      { id: "all", label: "全部", count: s.total },
      { id: "todo", label: "Todo", count: s.todoCount },
      { id: "issues", label: "Issue", count: s.issueCount },
      { id: "running", label: "运行中", count: s.running },
    ];
  }, [data]);

  const TODO_STATUSES = ["pending", "backlog", "ready", "running", "done", "cancelled"];
  const ISSUE_STATUSES = ["open", "ready", "running", "closed", "wontfix"];
  const ALL_STATUSES = [...new Set([...TODO_STATUSES, ...ISSUE_STATUSES])];

  const statusOptions = useMemo(() => {
    if (currentTab === "todo") return TODO_STATUSES;
    if (currentTab === "issues") return ISSUE_STATUSES;
    return ALL_STATUSES;
  }, [currentTab]);

  const allFilteredTasks = useMemo(() => {
    if (!data) return [];
    let tasks = data.tasks.slice();
    if (currentTab === "todo") tasks = tasks.filter((t) => t.type === "todo");
    else if (currentTab === "issues")
      tasks = tasks.filter((t) => t.type === "issue");
    else if (currentTab === "running")
      tasks = tasks.filter((t) => t.status === "running");

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

  const totalPages = Math.max(1, Math.ceil(allFilteredTasks.length / PAGE_SIZE));
  const filteredTasks = allFilteredTasks.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  // ── Handlers ──

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="panel-container">
        <div className="empty-state">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="panel-container">
      <div className="header-row">
        <div>
          <h1>Archon Admin</h1>
          <div className="subtitle">
            任务: {stats!.total} &middot; 运行中: {stats!.running} &middot;
            就绪: {stats!.ready}
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`help-btn${helpOpen ? " active" : ""}`}
            onClick={() => setHelpOpen((v) => !v)}
            title="Help"
          >
            {ICON_HELP}
          </button>
          <button className="refresh-btn" onClick={refresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {helpOpen && (
        <div className="help-panel">
          <div className="help-section">
            <div className="help-title">Todo 生命周期</div>
            <Mermaid chart={`flowchart LR
  pending([PENDING]) -->|就绪| backlog([BACKLOG])
  backlog -->|就绪| ready([READY])
  ready -->|派发| running([RUNNING])
  running -->|完成| done([DONE])
  pending -->|取消| cancelled([CANCELLED])
  backlog -->|取消| cancelled
  ready -->|取消| cancelled
  running -->|取消| cancelled
  ready -.->|post: 创建工作区| ready
  running -.->|post: 启动终端对话| running
  merge((合并成功)) -.->|post: merged+done| done
  linkStyle 8,9,10 stroke:#e67e22,color:#e67e22`} />
          </div>
          <div className="help-section">
            <div className="help-title">Issue 生命周期</div>
            <Mermaid chart={`flowchart LR
  open([OPEN]) -->|就绪| ready([READY])
  ready -->|派发| running([RUNNING])
  running -->|关闭| closed([CLOSED])
  open -->|不修| wontfix([WONTFIX])
  ready -->|不修| wontfix
  running -->|不修| wontfix
  ready -.->|post: 创建工作区| ready
  running -.->|post: 启动终端对话| running
  merge((合并成功)) -.->|post: merged+closed| closed
  linkStyle 6,7,8 stroke:#e67e22,color:#e67e22`} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-value">{stats!.total}</div>
          <div className="stat-label">总计</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats!.ready}</div>
          <div className="stat-label">就绪</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats!.running}</div>
          <div className="stat-label">运行中</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats!.completed}</div>
          <div className="stat-label">已完成</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab${currentTab === t.id ? " active" : ""}`}
            onClick={() => {
              setCurrentTab(t.id);
              setStatusFilter("all");
              setPage(1);
            }}
          >
            <span>{t.label}</span>
            <span className="count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <label>优先级:</label>
        {["all", "P0", "P1", "P2", "P3"].map((f) => (
          <button
            key={f}
            className={`filter-btn${currentFilter === f ? " active" : ""}`}
            onClick={() => {
              setCurrentFilter(f);
              setPage(1);
            }}
          >
            {f === "all" ? "全部" : f}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <label>状态:</label>
        {["all", ...statusOptions].map((f) => (
          <button
            key={f}
            className={`filter-btn${statusFilter === f ? " active" : ""}${f !== "all" ? ` filter-status-${f}` : ""}`}
            onClick={() => {
              setStatusFilter(f);
              setPage(1);
            }}
          >
            {f === "all" ? "全部" : f}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div>
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="icon">&#x1F4CB;</div>暂无任务
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>类型</th>
                <th>优先级</th>
                <th>标题</th>
                <th>状态</th>
                <th>工作区</th>
                <th>操作</th>
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

// Helper component to render TaskRow + conditional TaskExpanded
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
      <TaskRow task={task} expanded={expanded} onToggle={onToggle} onRefresh={onRefresh} />
      {expanded && (
        <tr className="expanded-row">
          <td colSpan={7}>
            <TaskExpanded task={task} onRefresh={onRefresh} />
          </td>
        </tr>
      )}
    </>
  );
}
