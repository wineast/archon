"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ModelConfigRow } from "@/db/schema";
import type { VersionMode } from "@/lib/versions/mode";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function modelConfigsApiKey(agentId?: string, mode?: VersionMode) {
  if (!agentId) return null;
  const params = new URLSearchParams({ agentId });
  if (mode === "published") {
    params.set("mode", "published");
  } else if (mode && typeof mode === "object") {
    params.set("versionId", mode.versionId);
  }
  return `/api/model-configs?${params}`;
}

export function activeModelConfigApiKey(agentId?: string, mode?: VersionMode) {
  if (!agentId) return null;
  const params = new URLSearchParams({ agentId });
  if (mode === "published") {
    params.set("mode", "published");
  } else if (mode && typeof mode === "object") {
    params.set("versionId", mode.versionId);
  }
  return `/api/model-configs/active?${params}`;
}

export function useModelConfigs(agentId?: string, mode?: VersionMode) {
  const { data, error, isLoading, mutate } = useSWR<ModelConfigRow[]>(
    modelConfigsApiKey(agentId, mode),
    fetcher
  );

  return {
    configs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useActiveModelConfig(agentId?: string, mode?: VersionMode) {
  const { data, error, isLoading, mutate } = useSWR<ModelConfigRow | null>(
    activeModelConfigApiKey(agentId, mode),
    fetcher
  );

  return {
    activeConfig: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createModelConfig(
  data: {
    agentId: string;
    key: string;
    name: string;
    systemPrompt?: string;
    temperature?: number;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/model-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("createModelConfig failed:", e);
    toast.error("Failed to create model config");
    return null;
  }
}

export async function updateModelConfig(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/model-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateModelConfig failed:", e);
    toast.error("Failed to save model config");
    return null;
  }
}

export async function deleteModelConfig(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/model-configs/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.warn("deleteModelConfig failed:", e);
    toast.error("Failed to delete model config");
    return false;
  }
}

export async function activateModelConfig(
  id: string,
  listMutate: () => void,
  activeMutate: () => void
) {
  try {
    const res = await fetch(`/api/model-configs/${id}/activate`, {
      method: "PUT",
    });
    if (!res.ok) throw new Error(await res.text());
    listMutate();
    activeMutate();
    return res.json();
  } catch (e) {
    console.warn("activateModelConfig failed:", e);
    toast.error("Failed to activate model config");
    return null;
  }
}
