"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { TrendPoint, CompareResponse, ModelStats } from "./benchmark-types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function benchmarkTrendsKey(agentId?: string) {
  return agentId ? `/api/eval/benchmark/trends?agentId=${agentId}` : null;
}

export function benchmarkModelsKey(agentId?: string) {
  return agentId ? `/api/eval/benchmark/models?agentId=${agentId}` : null;
}

export function benchmarkCompareKey(runA?: string, runB?: string) {
  return runA && runB
    ? `/api/eval/benchmark/compare?runA=${runA}&runB=${runB}`
    : null;
}

export function useBenchmarkTrends(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<TrendPoint[]>(
    benchmarkTrendsKey(agentId),
    fetcher
  );

  return {
    trends: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useBenchmarkCompare(runA?: string, runB?: string) {
  const { data, error, isLoading } = useSWR<CompareResponse>(
    benchmarkCompareKey(runA, runB),
    fetcher
  );

  return {
    comparison: data ?? null,
    isLoading,
    error,
  };
}

export function useBenchmarkModels(agentId?: string) {
  const { data, error, isLoading } = useSWR<ModelStats[]>(
    benchmarkModelsKey(agentId),
    fetcher
  );

  return {
    models: data ?? [],
    isLoading,
    error,
  };
}

export async function setBaseline(
  runId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBaseline: true }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("setBaseline failed:", e);
    toast.error("Failed to set baseline");
    return false;
  }
}

export async function clearBaseline(
  runId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`/api/eval/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBaseline: false }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("clearBaseline failed:", e);
    toast.error("Failed to clear baseline");
    return false;
  }
}
