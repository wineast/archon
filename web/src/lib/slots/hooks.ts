"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { SlotKey } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Types ─────────── */

export interface OrgSlotItem {
  id: string;
  slotKey: SlotKey;
  agentId: string;
  agentName: string;
  agentSlug: string;
  agentIcon: string;
}

export interface AgentSlotItem {
  slotKey: SlotKey;
  source: "override" | "org" | "default";
  agentId: string | null;
  agentName: string;
  agentSlug: string;
  agentIcon: string;
}

/* ─────────── Org Slots ─────────── */

export function useOrgSlots(orgId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<OrgSlotItem[]>(
    orgId ? `/api/orgs/${orgId}/slots` : null,
    fetcher
  );

  return {
    slots: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function updateOrgSlot(
  orgId: string,
  slotKey: SlotKey,
  agentId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/orgs/${orgId}/slots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotKey, agentId }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("updateOrgSlot failed:", e);
    toast.error("Failed to update slot");
    return false;
  }
}

/* ─────────── Agent Slot Overrides ─────────── */

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
    console.error("updateAgentSlotOverride failed:", e);
    toast.error("Failed to update slot override");
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
    console.error("deleteAgentSlotOverride failed:", e);
    toast.error("Failed to remove slot override");
    return false;
  }
}
