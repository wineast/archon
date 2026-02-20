"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type {
  ToolTestCaseRow,
  ToolTestRunRow,
  ToolTestRunResultRow,
} from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function apiBase(toolId: string) {
  return `/api/tools/${toolId}/test-cases`;
}

function runApiBase(toolId: string) {
  return `/api/tools/${toolId}/test-runs`;
}

export function useToolTestCases(toolId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ToolTestCaseRow[]>(
    toolId ? apiBase(toolId) : null,
    fetcher
  );

  return {
    testCases: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createToolTestCase(
  toolId: string,
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
    const res = await fetch(apiBase(toolId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createToolTestCase failed:", e);
    toast.error("Failed to create test case");
    return null;
  }
}

export async function updateToolTestCase(
  toolId: string,
  caseId: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(toolId)}/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateToolTestCase failed:", e);
    toast.error("Failed to update test case");
    return null;
  }
}

export async function deleteToolTestCase(
  toolId: string,
  caseId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(toolId)}/${caseId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteToolTestCase failed:", e);
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

export async function runToolTestCase(
  toolId: string,
  input: Record<string, unknown>,
  expectedOutput?: unknown
): Promise<RunTestCaseResult> {
  const res = await fetch(`${apiBase(toolId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, expectedOutput }),
  });
  return res.json();
}

// ── Tool Test Runs (persistent) ──

export interface ToolTestRunDetail {
  run: ToolTestRunRow;
  results: ToolTestRunResultRow[];
}

export function useToolTestRuns(toolId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ToolTestRunRow[]>(
    toolId ? runApiBase(toolId) : null,
    fetcher
  );

  return {
    runs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function fetchToolTestRunDetail(
  toolId: string,
  runId: string
): Promise<ToolTestRunDetail | null> {
  try {
    const res = await fetch(`${runApiBase(toolId)}/${runId}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.error("fetchToolTestRunDetail failed:", e);
    toast.error("Failed to load run detail");
    return null;
  }
}

export async function deleteToolTestRun(
  toolId: string,
  runId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`${runApiBase(toolId)}/${runId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteToolTestRun failed:", e);
    toast.error("Failed to delete run");
    return false;
  }
}
