"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ToolRow } from "@/db/schema";
import type { VersionMode } from "@/lib/versions/mode";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function toolsApiKey(agentId?: string, mode?: VersionMode) {
  if (!agentId) return null;
  const params = new URLSearchParams({ agentId });
  if (mode === "published") {
    params.set("mode", "published");
  } else if (mode && typeof mode === "object") {
    params.set("versionId", mode.versionId);
  }
  return `/api/tools?${params}`;
}

export function useTools(agentId?: string, mode?: VersionMode) {
  const { data, error, isLoading, mutate } = useSWR<ToolRow[]>(
    toolsApiKey(agentId, mode),
    fetcher
  );

  return {
    tools: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createTool(
  data: {
    agentId: string;
    key: string;
    name: string;
    description: string;
    handler?: string | null;
    url?: string | null;
    enabled?: boolean;
    componentId?: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("createTool failed:", e);
    toast.error("Failed to create tool");
    return null;
  }
}

export async function updateTool(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/tools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateTool failed:", e);
    toast.error("Failed to save tool");
    return null;
  }
}

export async function deleteTool(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/tools/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.warn("deleteTool failed:", e);
    toast.error("Failed to delete tool");
    return false;
  }
}

export async function toggleToolEnabled(
  id: string,
  enabled: boolean,
  mutate: () => void
) {
  return updateTool(id, { enabled }, mutate);
}
