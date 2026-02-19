"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { EvalCaseRow, EvalJudgeConfigRow, EvalRunRow } from "@/db/schema";
import type { EvalRunDetail } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function evalCasesKey(agentId?: string) {
  return agentId ? `/api/eval/cases?agentId=${agentId}` : null;
}

export function evalJudgeConfigsKey(agentId?: string) {
  return agentId ? `/api/eval/judge-configs?agentId=${agentId}` : null;
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

export function useEvalJudgeConfigs(agentId?: string, shouldFetch?: boolean) {
  const { data, error, isLoading, mutate } = useSWR<EvalJudgeConfigRow[]>(
    shouldFetch !== false ? evalJudgeConfigsKey(agentId) : null,
    fetcher
  );

  return {
    configs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useDefaultJudgeConfig(agentId?: string, shouldFetch?: boolean) {
  const { configs, isLoading, error, mutate } =
    useEvalJudgeConfigs(agentId, shouldFetch);
  const defaultConfig = configs.find((c) => c.isDefault) ?? null;

  return {
    defaultConfig,
    configs,
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
    input: string;
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
    console.error("createEvalCase failed:", e);
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
    console.error("updateEvalCase failed:", e);
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
    return true;
  } catch (e) {
    console.error("deleteEvalCase failed:", e);
    toast.error("Failed to delete case");
    return false;
  }
}

export async function createJudgeConfig(
  data: {
    agentId: string;
    key: string;
    name: string;
    model: string;
    systemPrompt: string;
    temperature?: number;
    isDefault?: boolean;
  },
  mutate: () => void
): Promise<EvalJudgeConfigRow | null> {
  try {
    const res = await fetch("/api/eval/judge-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const row = await res.json();
    mutate();
    return row;
  } catch (e) {
    console.error("createJudgeConfig failed:", e);
    toast.error("Failed to create judge config");
    return null;
  }
}

export async function updateJudgeConfig(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
): Promise<EvalJudgeConfigRow | null> {
  try {
    const res = await fetch(`/api/eval/judge-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const row = await res.json();
    mutate();
    return row;
  } catch (e) {
    console.error("updateJudgeConfig failed:", e);
    toast.error("Failed to save judge config");
    return null;
  }
}

export async function deleteJudgeConfig(
  id: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/judge-configs/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteJudgeConfig failed:", e);
    toast.error("Failed to delete judge config");
    return false;
  }
}

export async function setDefaultJudgeConfig(
  id: string,
  mutate: () => void
): Promise<EvalJudgeConfigRow | null> {
  try {
    const res = await fetch(`/api/eval/judge-configs/${id}/set-default`, {
      method: "PUT",
    });
    if (!res.ok) throw new Error(await res.text());
    const row = await res.json();
    mutate();
    return row;
  } catch (e) {
    console.error("setDefaultJudgeConfig failed:", e);
    toast.error("Failed to set default judge config");
    return null;
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
    console.error("fetchEvalRunDetail failed:", e);
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
    console.error("deleteEvalRun failed:", e);
    toast.error("Failed to delete run");
    return false;
  }
}
