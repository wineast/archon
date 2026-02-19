"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ComponentRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function componentsApiKey(agentId?: string) {
  return agentId ? `/api/components?agentId=${agentId}` : null;
}

export function useComponents(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ComponentRow[]>(
    componentsApiKey(agentId),
    fetcher
  );

  return {
    components: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createComponent(
  data: {
    agentId: string;
    key: string;
    name: string;
    description?: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createComponent failed:", e);
    toast.error("Failed to create component");
    return null;
  }
}

export async function updateComponent(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/components/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateComponent failed:", e);
    toast.error("Failed to save component");
    return null;
  }
}

export async function deleteComponent(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/components/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteComponent failed:", e);
    toast.error("Failed to delete component");
    return false;
  }
}
