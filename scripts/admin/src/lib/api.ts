import type {
  TasksData,
  ReportData,
  StatusData,
  MergeCheckData,
} from "./types";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Tasks ──────────────────────────────────────────────────

export function fetchTasksData(): Promise<TasksData> {
  return fetchJSON("/api/tasks/data");
}

export function fetchTaskDetail(
  path: string
): Promise<{ content: string }> {
  return fetchJSON(`/api/tasks/detail/${encodeURIComponent(path)}`);
}

export function moveTaskStatus(
  type: string,
  id: string,
  to: string
): Promise<{ ok: boolean }> {
  return fetchJSON("/api/tasks/move-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, id, to }),
  });
}

export function openTerminal(
  worktree: string,
  skill: string
): Promise<{ ok: boolean; activated: boolean }> {
  return fetchJSON("/api/tasks/open-terminal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worktree, skill }),
  });
}

export function checkTerminal(
  sessionId: string
): Promise<{ exists: boolean }> {
  return fetchJSON(
    `/api/tasks/terminal/${encodeURIComponent(sessionId)}`
  );
}

// ── Reports (inline per worktree) ─────────────────────────

export function fetchReportData(wt: string): Promise<ReportData> {
  return fetchJSON(`/api/reports/${encodeURIComponent(wt)}/data`);
}

export function fetchReportStatus(wt: string): Promise<StatusData> {
  return fetchJSON(`/api/reports/${encodeURIComponent(wt)}/status`);
}

export function fetchMergeCheck(wt: string): Promise<MergeCheckData> {
  return fetchJSON(`/api/reports/${encodeURIComponent(wt)}/merge-check`);
}

export function gitAdd(wt: string): Promise<{ ok: boolean }> {
  return fetchJSON(`/api/reports/${encodeURIComponent(wt)}/git-add`, {
    method: "POST",
  });
}

export function syncWorktree(wt: string): Promise<{ ok: boolean }> {
  return fetchJSON(`/api/reports/${encodeURIComponent(wt)}/sync`, {
    method: "POST",
  });
}

export function mergeWorktree(wt: string): Promise<{ ok: boolean }> {
  return fetchJSON(`/api/reports/${encodeURIComponent(wt)}/merge`, {
    method: "POST",
  });
}

export function fetchFileDiff(
  wt: string,
  filePath: string,
  source: "committed" | "staged" | "working" | "untracked"
): Promise<{ diff: string; filePath: string }> {
  const params = new URLSearchParams({ path: filePath, source });
  return fetchJSON(
    `/api/reports/${encodeURIComponent(wt)}/file-diff?${params}`
  );
}
