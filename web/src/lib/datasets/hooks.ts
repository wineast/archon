"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { DatasetRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function datasetsApiKey(agentId?: string) {
  return agentId ? `/api/datasets?agentId=${agentId}` : null;
}

export function useDatasets(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<DatasetRow[]>(
    datasetsApiKey(agentId),
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
    id ? `/api/datasets/${id}` : null,
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
export function useDatasetVarsMap(agentId?: string) {
  const { data } = useSWR<DatasetRow[]>(datasetsApiKey(agentId), fetcher);

  const datasetVars: Record<string, unknown> = {};
  if (data) {
    for (const row of data) {
      datasetVars[row.key] = row.data;
    }
  }

  return { datasetVars };
}

/**
 * Returns enumDatasetOptions (by dataset ID) and enumDatasetValues (by dataset ID)
 * for use with ParameterRow's enum dataset mode.
 */
export function useDatasetsMap(agentId?: string) {
  const { datasets } = useDatasets(agentId);

  const enumDatasetOptions: Array<{
    id: string;
    key: string;
    name: string;
    source: "dataset";
  }> = [];

  const enumDatasetValues: Record<string, string[]> = {};

  for (const ds of datasets) {
    enumDatasetOptions.push({
      id: ds.id,
      key: ds.key,
      name: ds.name,
      source: "dataset",
    });

    // Extract enum values
    const val = ds.data;
    if (Array.isArray(val)) {
      enumDatasetValues[ds.id] = val.map(String);
    } else if (typeof val === "object" && val !== null) {
      const values = Object.values(val as Record<string, unknown>);
      if (values.length > 0 && typeof values[0] === "string") {
        enumDatasetValues[ds.id] = values.map(String);
      } else {
        enumDatasetValues[ds.id] = Object.keys(val as Record<string, unknown>);
      }
    }
  }

  return { enumDatasetOptions, enumDatasetValues };
}

export async function createDataset(
  data: {
    key: string;
    name: string;
    description?: string;
    data?: unknown;
    agentId: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/datasets", {
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
    const res = await fetch(`/api/datasets/${id}`, {
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
    const res = await fetch(`/api/datasets/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteDataset failed:", e);
    toast.error("Failed to delete dataset");
    return false;
  }
}
