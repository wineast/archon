"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { AgentRow, AgentRole } from "@/db/schema";

const AGENTS_API_KEY = "/api/agents";
const TRASH_API_KEY = "/api/agents/trash";

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

export function useTrashAgents() {
  const { data, error, isLoading, mutate } = useSWR<AgentRow[]>(
    TRASH_API_KEY,
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
  mutate: KeyedMutator<AgentWithRole[]>,
  t: (key: string) => string
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
    toast.error(t("createFailed"));
    return null;
  }
}

export async function updateAgent(
  id: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<AgentWithRole[]>,
  t: (key: string) => string
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
    toast.error(t("updateFailed"));
    return null;
  }
}

export async function deleteAgent(
  id: string,
  mutate: KeyedMutator<AgentWithRole[]>,
  t?: (key: string) => string
) {
  try {
    const res = await fetch(`/api/agents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success(t?.("movedToTrash") ?? "已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteAgent failed:", e);
    toast.error(t?.("deleteFailed") ?? "删除 Agent 失败");
    return false;
  }
}

export async function restoreAgent(
  id: string,
  trashMutate: KeyedMutator<AgentRow[]>,
  agentsMutate: KeyedMutator<AgentWithRole[]>,
  t?: (key: string) => string
) {
  try {
    const res = await fetch(`/api/agents/${id}/restore`, {
      method: "PUT",
    });
    if (!res.ok) throw new Error(await res.text());
    trashMutate();
    agentsMutate();
    toast.success(t?.("restored") ?? "已恢复");
    return true;
  } catch (e) {
    console.error("restoreAgent failed:", e);
    toast.error(t?.("restoreFailed") ?? "恢复 Agent 失败");
    return false;
  }
}

export async function permanentDeleteAgent(
  id: string,
  mutate: KeyedMutator<AgentRow[]>,
  t?: (key: string) => string
) {
  try {
    const res = await fetch(`/api/agents/${id}/permanent`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success(t?.("permanentlyDeleted") ?? "已永久删除");
    return true;
  } catch (e) {
    console.error("permanentDeleteAgent failed:", e);
    toast.error(t?.("permanentDeleteFailed") ?? "永久删除失败");
    return false;
  }
}
