"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { DatasetRow } from "@/db/schema";

export const DATASETS_API_KEY = "/api/datasets";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useDatasets() {
  const { data, error, isLoading, mutate } = useSWR<DatasetRow[]>(
    DATASETS_API_KEY,
    fetcher
  );

  return {
    datasets: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useDataset(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<DatasetRow>(
    id ? `${DATASETS_API_KEY}/${id}` : null,
    fetcher
  );

  return {
    dataset: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

/** Returns all dataset keys → data as a flat map. */
export function useDatasetVarsMap() {
  const { data } = useSWR<DatasetRow[]>(DATASETS_API_KEY, fetcher);

  const datasetVars: Record<string, unknown> = {};
  if (data) {
    for (const row of data) {
      datasetVars[row.key] = row.data;
    }
  }

  return { datasetVars };
}

export async function createDataset(
  data: {
    key: string;
    name: string;
    description?: string;
    data?: unknown;
    agentId?: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch(DATASETS_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create dataset");
    }
    mutate();
    return res.json();
  } catch (e) {
    console.error("createDataset failed:", e);
    toast.error((e as Error).message || "Failed to create dataset");
    return null;
  }
}

export async function updateDataset(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`${DATASETS_API_KEY}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to save dataset");
    }
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateDataset failed:", e);
    toast.error((e as Error).message || "Failed to save dataset");
    return null;
  }
}

export async function deleteDataset(id: string, mutate: () => void) {
  try {
    const res = await fetch(`${DATASETS_API_KEY}/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteDataset failed:", e);
    toast.error("Failed to delete dataset");
    return false;
  }
}
