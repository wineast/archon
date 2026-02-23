"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { ChatConfigRow } from "@/db/schema";
import type { VersionMode } from "@/lib/versions/mode";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function chatConfigApiKey(agentId?: string, mode?: VersionMode) {
  if (!agentId) return null;
  const params = new URLSearchParams({ agentId });
  if (mode === "published") {
    params.set("mode", "published");
  } else if (mode && typeof mode === "object") {
    params.set("versionId", mode.versionId);
  }
  return `/api/chat-configs?${params}`;
}

export function useChatConfig(agentId?: string, mode?: VersionMode) {
  const { data, error, isLoading, mutate } = useSWR<ChatConfigRow>(
    chatConfigApiKey(agentId, mode),
    fetcher
  );

  return {
    config: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function updateChatConfig(
  id: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<ChatConfigRow>
) {
  try {
    const res = await fetch(`/api/chat-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateChatConfig failed:", e);
    toast.error("Failed to save config");
    return null;
  }
}
