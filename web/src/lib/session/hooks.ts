"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ChatSession } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function sessionsKey(agentId?: string) {
  return agentId ? `/api/sessions?agentId=${agentId}` : "/api/sessions";
}

export function useSessions(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ChatSession[]>(
    sessionsKey(agentId),
    fetcher
  );

  return {
    sessions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function deleteSession(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteSession failed:", e);
    toast.error("删除会话失败");
    return false;
  }
}
