"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { EvalCaseRow, EvalRunRow, EvalBatchRow } from "@/db/schema";
import type { EvalRunDetail, EvalBatchDetail, CreateEvalBatchRequest, CreateEvalBatchResponse } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function evalCasesKey(agentId?: string) {
  return agentId ? `/api/eval/cases?agentId=${agentId}` : null;
}

export function evalRunsKey(agentId?: string) {
  return agentId ? `/api/eval/runs?agentId=${agentId}` : null;
}

export function evalBatchesKey(agentId?: string) {
  return agentId ? `/api/eval/batches?agentId=${agentId}` : null;
}

export function useEvalCases(agentId?: string, shouldFetch?: boolean) {
  const { data, error, isLoading, mutate } = useSWR<EvalCaseRow[]>(
    shouldFetch !== false ? evalCasesKey(agentId) : null,
    fetcher
  );

  return {
    cases: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

// ── CRUD functions ──

export async function createEvalCase(
  data: {
    agentId: string;
    key: string;
    name: string;
    mode: import("./types").EvalCaseMode;
    turns: import("./types").EvalTurn[];
    expectedOutput?: string;
    assertions?: unknown[];
  },
  mutate: () => void
): Promise<EvalCaseRow | null> {
  try {
    const res = await fetch("/api/eval/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const row = await res.json();
    mutate();
    return row;
  } catch (e) {
    console.warn("createEvalCase failed:", e);
    toast.error("Failed to create case");
    return null;
  }
}

export async function updateEvalCase(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
): Promise<EvalCaseRow | null> {
  try {
    const res = await fetch(`/api/eval/cases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const row = await res.json();
    mutate();
    return row;
  } catch (e) {
    console.warn("updateEvalCase failed:", e);
    toast.error("Failed to save case");
    return null;
  }
}

export async function deleteEvalCase(
  id: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/cases/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.warn("deleteEvalCase failed:", e);
    toast.error("Failed to delete case");
    return false;
  }
}

// ── Batch refresh tool snapshots ──

export async function batchRefreshTools(
  agentId: string,
  mutate: () => void
): Promise<{ casesRefreshed: number; totalToolCalls: number; errors: string[] } | null> {
  try {
    const res = await fetch(
      `/api/eval/cases/refresh-tools?agentId=${agentId}`,
      { method: "POST" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    const result = await res.json();
    mutate();
    return result;
  } catch (e) {
    toast.error(
      e instanceof Error ? e.message : "Failed to batch refresh tools"
    );
    return null;
  }
}

// ── Eval Runs ──

export function useEvalRuns(agentId?: string, shouldFetch?: boolean) {
  const [hasRunning, setHasRunning] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<EvalRunRow[]>(
    shouldFetch !== false ? evalRunsKey(agentId) : null,
    fetcher,
    { refreshInterval: hasRunning ? 2000 : 0 }
  );

  const runs = data ?? [];

  useEffect(() => {
    setHasRunning(runs.some((r) => r.status === "running"));
  }, [runs]);

  return {
    runs,
    isLoading,
    error,
    mutate,
  };
}

export async function fetchEvalRunDetail(
  id: string
): Promise<EvalRunDetail | null> {
  try {
    const res = await fetch(`/api/eval/runs/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.warn("fetchEvalRunDetail failed:", e);
    toast.error("Failed to load run detail");
    return null;
  }
}

export async function deleteEvalRun(
  id: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/runs/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteEvalRun failed:", e);
    toast.error("Failed to delete run");
    return false;
  }
}

export async function retryFailedCases(
  runId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/run/${runId}/retry-failed`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    mutate();
    return true;
  } catch (e) {
    console.warn("retryFailedCases failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to retry failed cases");
    return false;
  }
}

// ── Eval Batches ──

export function useEvalBatches(agentId?: string, shouldFetch?: boolean) {
  const [hasRunning, setHasRunning] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<EvalBatchRow[]>(
    shouldFetch !== false ? evalBatchesKey(agentId) : null,
    fetcher,
    { refreshInterval: hasRunning ? 2000 : 0 }
  );

  const batches = data ?? [];

  useEffect(() => {
    setHasRunning(batches.some((b) => b.status === "running"));
  }, [batches]);

  return {
    batches,
    isLoading,
    error,
    mutate,
  };
}

export async function createEvalBatch(
  data: CreateEvalBatchRequest,
  mutate: () => void
): Promise<CreateEvalBatchResponse | null> {
  try {
    const res = await fetch("/api/eval/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || `HTTP ${res.status}`);
    }
    const result: CreateEvalBatchResponse = await res.json();
    mutate();
    return result;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed to create eval batch");
    return null;
  }
}

export async function cancelEvalBatch(
  batchId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/batch/${batchId}/cancel`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    mutate();
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed to cancel batch");
    return false;
  }
}

export async function deleteEvalBatch(
  id: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/batches/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteEvalBatch failed:", e);
    toast.error("Failed to delete batch");
    return false;
  }
}

export async function fetchEvalBatchDetail(
  id: string
): Promise<EvalBatchDetail | null> {
  try {
    const res = await fetch(`/api/eval/batches/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.warn("fetchEvalBatchDetail failed:", e);
    toast.error("Failed to load batch detail");
    return null;
  }
}
