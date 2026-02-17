"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { ChatConfigRow } from "@/db/schema";

export const CHAT_CONFIG_API_KEY = "/api/chat-configs";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useChatConfig() {
  const { data, error, isLoading, mutate } = useSWR<ChatConfigRow>(
    CHAT_CONFIG_API_KEY,
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
    console.error("updateChatConfig failed:", e);
    toast.error("Failed to save config");
    return null;
  }
}
