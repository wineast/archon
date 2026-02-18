"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { DataObjectRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function dataObjectsApiKey(agentId?: string) {
  return agentId ? `/api/data-objects?agentId=${agentId}` : null;
}

export function useDataObjects(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<DataObjectRow[]>(
    dataObjectsApiKey(agentId),
    fetcher
  );

  return {
    objects: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useDataObject(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<DataObjectRow>(
    id ? `/api/data-objects/${id}` : null,
    fetcher
  );

  return {
    object: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createDataObject(
  data: {
    key: string;
    name: string;
    description?: string;
    data?: Record<string, unknown>;
    agentId: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/data-objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createDataObject failed:", e);
    toast.error("Failed to create data object");
    return null;
  }
}

export async function updateDataObject(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/data-objects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateDataObject failed:", e);
    toast.error("Failed to save data object");
    return null;
  }
}

export async function deleteDataObject(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/data-objects/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteDataObject failed:", e);
    toast.error("Failed to delete data object");
    return false;
  }
}
