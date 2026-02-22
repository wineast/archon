"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { FunctionRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function functionsApiKey(agentId?: string) {
  return agentId ? `/api/functions?agentId=${agentId}` : null;
}

export function useFunctions(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<WithPoolMeta<FunctionRow>[]>(
    functionsApiKey(agentId),
    fetcher
  );

  return {
    functions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useFunction(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FunctionRow>(
    id ? `/api/functions/${id}` : null,
    fetcher
  );

  return {
    fn: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createFunction(
  data: {
    key: string;
    name: string;
    description?: string;
    code: string;
    agentId: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/functions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createFunction failed:", e);
    toast.error("Failed to create function");
    return null;
  }
}

export async function updateFunction(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/functions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateFunction failed:", e);
    toast.error("Failed to save function");
    return null;
  }
}

export async function deleteFunction(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/functions/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteFunction failed:", e);
    toast.error("Failed to delete function");
    return false;
  }
}
