"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type {
  FunctionTestCaseRow,
  FunctionTestRunRow,
  FunctionTestRunResultRow,
} from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function apiBase(functionId: string) {
  return `/api/functions/${functionId}/test-cases`;
}

function runApiBase(functionId: string) {
  return `/api/functions/${functionId}/test-runs`;
}

export function useFunctionTestCases(functionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FunctionTestCaseRow[]>(
    functionId ? apiBase(functionId) : null,
    fetcher
  );

  return {
    testCases: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createFunctionTestCase(
  functionId: string,
  data: {
    name: string;
    input: Record<string, unknown>;
    expectedOutput?: unknown;
    tags?: string[];
    showAsExample?: boolean;
  },
  mutate: () => void
) {
  try {
    const res = await fetch(apiBase(functionId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("createFunctionTestCase failed:", e);
    toast.error("Failed to create test case");
    return null;
  }
}

export async function updateFunctionTestCase(
  functionId: string,
  caseId: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(functionId)}/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateFunctionTestCase failed:", e);
    toast.error("Failed to update test case");
    return null;
  }
}

export async function deleteFunctionTestCase(
  functionId: string,
  caseId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(functionId)}/${caseId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteFunctionTestCase failed:", e);
    toast.error("Failed to delete test case");
    return false;
  }
}

export interface RunTestCaseResult {
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  passed: boolean;
}

export async function runFunctionTestCase(
  functionId: string,
  input: Record<string, unknown>,
  expectedOutput?: unknown
): Promise<RunTestCaseResult> {
  const res = await fetch(`${apiBase(functionId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, expectedOutput }),
  });
  return res.json();
}

// ── Function Test Runs (persistent) ──

export interface FunctionTestRunDetail {
  run: FunctionTestRunRow;
  results: FunctionTestRunResultRow[];
}

export function useFunctionTestRuns(functionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FunctionTestRunRow[]>(
    functionId ? runApiBase(functionId) : null,
    fetcher
  );

  return {
    runs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function fetchFunctionTestRunDetail(
  functionId: string,
  runId: string
): Promise<FunctionTestRunDetail | null> {
  try {
    const res = await fetch(`${runApiBase(functionId)}/${runId}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.warn("fetchFunctionTestRunDetail failed:", e);
    toast.error("Failed to load run detail");
    return null;
  }
}

export async function deleteFunctionTestRun(
  functionId: string,
  runId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`${runApiBase(functionId)}/${runId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteFunctionTestRun failed:", e);
    toast.error("Failed to delete run");
    return false;
  }
}
