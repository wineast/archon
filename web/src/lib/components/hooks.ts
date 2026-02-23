"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ComponentRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";
import type { VersionMode } from "@/lib/versions/mode";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function componentsApiKey(agentId?: string, mode?: VersionMode) {
  if (!agentId) return null;
  const params = new URLSearchParams({ agentId });
  if (mode === "published") {
    params.set("mode", "published");
  } else if (mode && typeof mode === "object") {
    params.set("versionId", mode.versionId);
  }
  return `/api/components?${params}`;
}

export function useComponents(agentId?: string, mode?: VersionMode) {
  const { data, error, isLoading, mutate } = useSWR<WithPoolMeta<ComponentRow>[]>(
    componentsApiKey(agentId, mode),
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
    console.warn("createComponent failed:", e);
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
    console.warn("updateComponent failed:", e);
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
    console.warn("deleteComponent failed:", e);
    toast.error("Failed to delete component");
    return false;
  }
}
