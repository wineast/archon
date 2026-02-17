"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { EvalCaseRow, EvalJudgeConfigRow, EvalRunRow } from "@/db/schema";
import type { EvalRunDetail } from "./types";

export const EVAL_CASES_KEY = "/api/eval/cases";
export const EVAL_JUDGE_CONFIGS_KEY = "/api/eval/judge-configs";
export const EVAL_RUNS_KEY = "/api/eval/runs";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useEvalCases(shouldFetch?: boolean) {
  const { data, error, isLoading, mutate } = useSWR<EvalCaseRow[]>(
    shouldFetch !== false ? EVAL_CASES_KEY : null,
    fetcher
  );

  return {
    cases: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useEvalJudgeConfigs(shouldFetch?: boolean) {
  const { data, error, isLoading, mutate } = useSWR<EvalJudgeConfigRow[]>(
    shouldFetch !== false ? EVAL_JUDGE_CONFIGS_KEY : null,
    fetcher
  );

  return {
    configs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useDefaultJudgeConfig(shouldFetch?: boolean) {
  const { configs, isLoading, error, mutate } =
    useEvalJudgeConfigs(shouldFetch);
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
    name: string;
    input: string;
    expectedOutput?: string;
    assertions?: unknown[];
  },
  mutate: () => void
): Promise<EvalCaseRow | null> {
  try {
    const res = await fetch(EVAL_CASES_KEY, {
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
    const res = await fetch(`${EVAL_CASES_KEY}/${id}`, {
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
    const res = await fetch(`${EVAL_CASES_KEY}/${id}`, {
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
    name: string;
    model: string;
    systemPrompt: string;
    temperature?: number;
    isDefault?: boolean;
  },
  mutate: () => void
): Promise<EvalJudgeConfigRow | null> {
  try {
    const res = await fetch(EVAL_JUDGE_CONFIGS_KEY, {
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
    const res = await fetch(`${EVAL_JUDGE_CONFIGS_KEY}/${id}`, {
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
    const res = await fetch(`${EVAL_JUDGE_CONFIGS_KEY}/${id}`, {
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
    const res = await fetch(`${EVAL_JUDGE_CONFIGS_KEY}/${id}/set-default`, {
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

export function useEvalRuns(shouldFetch?: boolean) {
  const { data, error, isLoading, mutate } = useSWR<EvalRunRow[]>(
    shouldFetch !== false ? EVAL_RUNS_KEY : null,
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
    const res = await fetch(`${EVAL_RUNS_KEY}/${id}`);
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
    const res = await fetch(`${EVAL_RUNS_KEY}/${id}`, {
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
