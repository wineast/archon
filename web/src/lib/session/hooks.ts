"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ChatSession } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function sessionsKey(
  agentId?: string,
  showAll?: boolean,
  source?: string,
) {
  if (!agentId) return "/api/sessions";
  const params = new URLSearchParams({ agentId });
  if (showAll) params.set("all", "true");
  if (source) params.set("source", source);
  return `/api/sessions?${params}`;
}

export function useSessions(
  agentId?: string,
  showAll?: boolean,
  source?: string,
) {
  const { data, error, isLoading, mutate } = useSWR<ChatSession[]>(
    sessionsKey(agentId, showAll, source),
    fetcher,
  );

  return {
    sessions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function renameSession(
  id: string,
  title: string,
  mutate: () => void,
) {
  try {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("renameSession failed:", e);
    toast.error("Failed to rename conversation");
    return false;
  }
}

export async function deleteSession(
  id: string,
  mutate: () => void,
  t?: (key: string) => string,
) {
  try {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteSession failed:", e);
    toast.error(t?.("deleteSessionFailed") ?? "Failed to delete conversation");
    return false;
  }
}
