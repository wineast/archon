"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { EmbedTokenRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useEmbedTokens(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<EmbedTokenRow[]>(
    agentId ? `/api/agents/${agentId}/embed-tokens` : null,
    fetcher
  );

  return {
    tokens: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createEmbedToken(
  agentId: string,
  data: { name: string; allowedOrigins?: string[] },
  mutate: KeyedMutator<EmbedTokenRow[]>
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/embed-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("createEmbedToken failed:", e);
    toast.error("Failed to create token");
    return null;
  }
}

export async function updateEmbedToken(
  agentId: string,
  tokenId: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<EmbedTokenRow[]>
) {
  try {
    const res = await fetch(
      `/api/agents/${agentId}/embed-tokens/${tokenId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateEmbedToken failed:", e);
    toast.error("Failed to update token");
    return null;
  }
}

export async function deleteEmbedToken(
  agentId: string,
  tokenId: string,
  mutate: KeyedMutator<EmbedTokenRow[]>
) {
  try {
    const res = await fetch(
      `/api/agents/${agentId}/embed-tokens/${tokenId}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteEmbedToken failed:", e);
    toast.error("Failed to delete token");
    return false;
  }
}
