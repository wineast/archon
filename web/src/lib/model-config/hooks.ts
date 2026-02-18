"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ModelConfigRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function modelConfigsApiKey(agentId?: string) {
  return agentId ? `/api/model-configs?agentId=${agentId}` : null;
}

export function activeModelConfigApiKey(agentId?: string) {
  return agentId ? `/api/model-configs/active?agentId=${agentId}` : null;
}

export function useModelConfigs(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ModelConfigRow[]>(
    modelConfigsApiKey(agentId),
    fetcher
  );

  return {
    configs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useActiveModelConfig(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ModelConfigRow | null>(
    activeModelConfigApiKey(agentId),
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
    console.error("createModelConfig failed:", e);
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
    console.error("updateModelConfig failed:", e);
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
    return true;
  } catch (e) {
    console.error("deleteModelConfig failed:", e);
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
    console.error("activateModelConfig failed:", e);
    toast.error("Failed to activate model config");
    return null;
  }
}
