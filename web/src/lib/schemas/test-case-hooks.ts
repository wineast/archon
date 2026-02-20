"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type {
  SchemaTestCaseRow,
  SchemaTestRunRow,
  SchemaTestRunResultRow,
} from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function apiBase(schemaId: string) {
  return `/api/schemas/${schemaId}/test-cases`;
}

function runApiBase(schemaId: string) {
  return `/api/schemas/${schemaId}/test-runs`;
}

export function useSchemaTestCases(schemaId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<SchemaTestCaseRow[]>(
    schemaId ? apiBase(schemaId) : null,
    fetcher
  );

  return {
    testCases: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createSchemaTestCase(
  schemaId: string,
  data: {
    name: string;
    input: Record<string, unknown>;
    shouldPass: boolean;
    expectedErrors?: Array<{ path: string; message: string }>;
    tags?: string[];
    showAsExample?: boolean;
  },
  mutate: () => void
) {
  try {
    const res = await fetch(apiBase(schemaId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createSchemaTestCase failed:", e);
    toast.error("Failed to create test case");
    return null;
  }
}

export async function updateSchemaTestCase(
  schemaId: string,
  caseId: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(schemaId)}/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateSchemaTestCase failed:", e);
    toast.error("Failed to update test case");
    return null;
  }
}

export async function deleteSchemaTestCase(
  schemaId: string,
  caseId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`${apiBase(schemaId)}/${caseId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteSchemaTestCase failed:", e);
    toast.error("Failed to delete test case");
    return false;
  }
}

export interface SchemaRunTestCaseResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
  durationMs: number;
  passed: boolean;
}

export async function runSchemaTestCase(
  schemaId: string,
  input: Record<string, unknown>,
  shouldPass: boolean,
  expectedErrors?: Array<{ path: string; message: string }>
): Promise<SchemaRunTestCaseResult> {
  const res = await fetch(`/api/schemas/${schemaId}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  const data = await res.json();

  const valid: boolean = data.valid;
  const errors: Array<{ path: string; message: string }> = data.errors ?? [];
  const durationMs: number = data.durationMs ?? 0;

  // Determine pass/fail using the same logic as the server
  let passed: boolean;
  if (shouldPass) {
    passed = valid === true;
  } else {
    if (!expectedErrors || expectedErrors.length === 0) {
      passed = valid === false;
    } else {
      passed = valid === false && expectedErrors.every((expected) =>
        errors.some(
          (actual) =>
            actual.path === expected.path &&
            actual.message.includes(expected.message)
        )
      );
    }
  }

  return { valid, errors, durationMs, passed };
}

// ── Schema Test Runs (persistent) ──

export interface SchemaTestRunDetail {
  run: SchemaTestRunRow;
  results: SchemaTestRunResultRow[];
}

export function useSchemaTestRuns(schemaId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<SchemaTestRunRow[]>(
    schemaId ? runApiBase(schemaId) : null,
    fetcher
  );

  return {
    runs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function fetchSchemaTestRunDetail(
  schemaId: string,
  runId: string
): Promise<SchemaTestRunDetail | null> {
  try {
    const res = await fetch(`${runApiBase(schemaId)}/${runId}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.error("fetchSchemaTestRunDetail failed:", e);
    toast.error("Failed to load run detail");
    return null;
  }
}

export async function deleteSchemaTestRun(
  schemaId: string,
  runId: string,
  mutate: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`${runApiBase(schemaId)}/${runId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteSchemaTestRun failed:", e);
    toast.error("Failed to delete run");
    return false;
  }
}
