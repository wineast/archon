"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { AgentRow } from "@/db/schema";

const AGENTS_API_KEY = "/api/agents";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<AgentRow[]>(
    AGENTS_API_KEY,
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
  data: { name: string; description?: string; icon?: string; slug?: string },
  mutate: KeyedMutator<AgentRow[]>
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
  mutate: KeyedMutator<AgentRow[]>
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
  mutate: KeyedMutator<AgentRow[]>
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
