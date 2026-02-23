"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { SlotKey } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Types ─────────── */

export interface AgentSlotItem {
  slotKey: SlotKey;
  agentId: string | null;
  agentName: string;
  agentSlug: string;
  agentIcon: string;
}

/* ─────────── Agent Slots ─────────── */

export function useAgentSlots(agentId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<AgentSlotItem[]>(
    agentId ? `/api/agents/${agentId}/slots` : null,
    fetcher
  );

  return {
    slots: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function updateAgentSlotOverride(
  agentId: string,
  slotKey: SlotKey,
  targetAgentId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/slots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotKey, targetAgentId }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("updateAgentSlotOverride failed:", e);
    toast.error("Failed to update slot");
    return false;
  }
}

export async function deleteAgentSlotOverride(
  agentId: string,
  slotKey: SlotKey,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/slots`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotKey }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteAgentSlotOverride failed:", e);
    toast.error("Failed to remove slot");
    return false;
  }
}
