"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { AgentRow, AgentRole } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type AgentWithRole = AgentRow & { myRole: AgentRole | null; orgSlug?: string };

export function useAgents(orgId?: string) {
  const key = orgId ? `/api/agents?orgId=${orgId}` : "/api/agents";
  const { data, error, isLoading, mutate } = useSWR<AgentWithRole[]>(
    key,
    fetcher
  );

  return {
    agents: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createAgent(
  data: { name: string; description?: string; icon?: string; slug?: string; orgId: string },
  mutate: KeyedMutator<AgentWithRole[]>
) {
  try {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createAgent failed:", e);
    toast.error("创建 Agent 失败");
    return null;
  }
}

export async function updateAgent(
  id: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<AgentWithRole[]>
) {
  try {
    const res = await fetch(`/api/agents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateAgent failed:", e);
    toast.error("更新 Agent 失败");
    return null;
  }
}

export async function deleteAgent(
  id: string,
  mutate: KeyedMutator<AgentWithRole[]>
) {
  try {
    const res = await fetch(`/api/agents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteAgent failed:", e);
    toast.error("删除 Agent 失败");
    return false;
  }
}
