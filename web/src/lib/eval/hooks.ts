"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { EvalCaseRow, EvalRunRow } from "@/db/schema";
import type { EvalRunDetail } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function evalCasesKey(agentId?: string) {
  return agentId ? `/api/eval/cases?agentId=${agentId}` : null;
}

export function evalRunsKey(agentId?: string) {
  return agentId ? `/api/eval/runs?agentId=${agentId}` : null;
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

// ── Eval Runs ──

export function useEvalRuns(agentId?: string, shouldFetch?: boolean) {
  const { data, error, isLoading, mutate } = useSWR<EvalRunRow[]>(
    shouldFetch !== false ? evalRunsKey(agentId) : null,
    fetcher
  );

  return {
    runs: data ?? [],
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
