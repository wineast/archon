"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type {
  ComponentTestCaseRow,
  ComponentTestRunRow,
  ComponentTestRunResultRow,
} from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function apiBase(componentId: string) {
  return `/api/components/${componentId}/test-cases`;
}

function runApiBase(componentId: string) {
  return `/api/components/${componentId}/test-runs`;
}

export function useComponentTestCases(componentId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ComponentTestCaseRow[]>(
    componentId ? apiBase(componentId) : null,
    fetcher
  );

  return {
    testCases: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createComponentTestCase(
  componentId: string,
  data: {
    name: string;
    tool: { name: string; input: unknown; output: unknown };
    tags?: string[];
    showAsExample?: boolean;
  },
  mutate: () => void
) {
  try {
    const res = await fetch(apiBase(componentId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createComponentTestCase failed:", e);
    toast.error("Failed to create test case");
    return null;
  }
}

export async function updateComponentTestCase(
  componentId: string,
  caseId: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(componentId)}/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateComponentTestCase failed:", e);
    toast.error("Failed to update test case");
    return null;
  }
}

export async function deleteComponentTestCase(
  componentId: string,
  caseId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(componentId)}/${caseId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteComponentTestCase failed:", e);
    toast.error("Failed to delete test case");
    return false;
  }
}

// ── Component Test Runs (persistent) ──

export interface ComponentTestRunDetail {
  run: ComponentTestRunRow;
  results: ComponentTestRunResultRow[];
}

export function useComponentTestRuns(componentId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ComponentTestRunRow[]>(
    componentId ? runApiBase(componentId) : null,
    fetcher
  );

  return {
    runs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function fetchComponentTestRunDetail(
  componentId: string,
  runId: string
): Promise<ComponentTestRunDetail | null> {
  try {
    const res = await fetch(`${runApiBase(componentId)}/${runId}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.error("fetchComponentTestRunDetail failed:", e);
    toast.error("Failed to load run detail");
    return null;
  }
}

export async function deleteComponentTestRun(
  componentId: string,
  runId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`${runApiBase(componentId)}/${runId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteComponentTestRun failed:", e);
    toast.error("Failed to delete run");
    return false;
  }
}
