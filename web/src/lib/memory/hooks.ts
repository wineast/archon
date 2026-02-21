"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { AgentRow, MemoryConfigRow, MemoryRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Feature Toggle ─────────── */

export async function toggleMemoryFeature(
  agentId: string,
  enabled: boolean,
  mutateAgent: KeyedMutator<AgentRow>
) {
  try {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryEnabled: enabled }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutateAgent();
  } catch (e) {
    console.error("toggleMemoryFeature failed:", e);
    toast.error("Failed to toggle memory feature");
  }
}

/* ─────────── Memory Config (1:1) ─────────── */

export function memoryConfigApiKey(agentId?: string) {
  return agentId ? `/api/memory-configs?agentId=${agentId}` : null;
}

export function useMemoryConfig(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<MemoryConfigRow>(
    memoryConfigApiKey(agentId),
    fetcher
  );

  return {
    config: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function updateMemoryConfig(
  id: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<MemoryConfigRow>
) {
  try {
    const res = await fetch(`/api/memory-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateMemoryConfig failed:", e);
    toast.error("Failed to save memory config");
    return null;
  }
}

/* ─────────── Memories (list) ─────────── */

export function memoriesApiKey(agentId?: string) {
  return agentId ? `/api/memories?agentId=${agentId}` : null;
}

export function useMemories(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<MemoryRow[]>(
    memoriesApiKey(agentId),
    fetcher
  );

  return {
    memories: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createMemory(
  data: {
    agentId: string;
    type: string;
    content: string;
    userId?: string | null;
    importance?: number;
    expiresAt?: string | null;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createMemory failed:", e);
    toast.error("Failed to create memory");
    return null;
  }
}

export async function updateMemory(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateMemory failed:", e);
    toast.error("Failed to save memory");
    return null;
  }
}

export async function deleteMemory(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    return true;
  } catch (e) {
    console.error("deleteMemory failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete memory");
    return false;
  }
}
