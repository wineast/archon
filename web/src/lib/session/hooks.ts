"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ChatSession } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function sessionsKey(agentId?: string, showAll?: boolean) {
  if (!agentId) return "/api/sessions";
  const params = new URLSearchParams({ agentId });
  if (showAll) params.set("all", "true");
  return `/api/sessions?${params}`;
}

export function useSessions(agentId?: string, showAll?: boolean) {
  const { data, error, isLoading, mutate } = useSWR<ChatSession[]>(
    sessionsKey(agentId, showAll),
    fetcher
  );

  return {
    sessions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function deleteSession(id: string, mutate: () => void, t?: (key: string) => string) {
  try {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteSession failed:", e);
    toast.error(t?.("deleteSessionFailed") ?? "删除会话失败");
    return false;
  }
}
