"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { JudgeConfigRow } from "@/db/schema";
import type { Dimension } from "@/lib/eval/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function judgeConfigsApiKey(agentId?: string) {
  return agentId ? `/api/judge-configs?agentId=${agentId}` : null;
}

export function activeJudgeConfigApiKey(agentId?: string) {
  return agentId ? `/api/judge-configs/active?agentId=${agentId}` : null;
}

export function useJudgeConfigs(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<JudgeConfigRow[]>(
    judgeConfigsApiKey(agentId),
    fetcher
  );

  return {
    configs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useActiveJudgeConfig(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<JudgeConfigRow | null>(
    activeJudgeConfigApiKey(agentId),
    fetcher
  );

  return {
    activeConfig: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createJudgeConfig(
  data: {
    agentId: string;
    key: string;
    name: string;
    dimensions?: Dimension[];
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/judge-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createJudgeConfig failed:", e);
    toast.error("Failed to create judge config");
    return null;
  }
}

export async function updateJudgeConfig(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/judge-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateJudgeConfig failed:", e);
    toast.error("Failed to save judge config");
    return null;
  }
}

export async function deleteJudgeConfig(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/judge-configs/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteJudgeConfig failed:", e);
    toast.error("Failed to delete judge config");
    return false;
  }
}

export async function activateJudgeConfig(
  id: string,
  listMutate: () => void,
  activeMutate: () => void
) {
  try {
    const res = await fetch(`/api/judge-configs/${id}/activate`, {
      method: "PUT",
    });
    if (!res.ok) throw new Error(await res.text());
    listMutate();
    activeMutate();
    return res.json();
  } catch (e) {
    console.error("activateJudgeConfig failed:", e);
    toast.error("Failed to activate judge config");
    return null;
  }
}
