"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { AgentSlotKey, OrgSlotKey } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Types ─────────── */

export interface AgentSlotItem {
  slotKey: AgentSlotKey;
  agentId: string | null;
  agentName: string;
  agentSlug: string;
  agentIcon: string;
}

export interface OrgSlotItem {
  slotKey: OrgSlotKey;
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

export async function updateAgentSlot(
  agentId: string,
  slotKey: AgentSlotKey,
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
    console.warn("updateAgentSlot failed:", e);
    toast.error("Failed to update slot");
    return false;
  }
}

export async function deleteAgentSlot(
  agentId: string,
  slotKey: AgentSlotKey,
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
    console.warn("deleteAgentSlot failed:", e);
    toast.error("Failed to remove slot");
    return false;
  }
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
  slotKey: OrgSlotKey,
  targetAgentId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/orgs/${orgId}/slots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotKey, targetAgentId }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("updateOrgSlot failed:", e);
    toast.error("Failed to update slot");
    return false;
  }
}

export async function deleteOrgSlot(
  orgId: string,
  slotKey: OrgSlotKey,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/orgs/${orgId}/slots`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotKey }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteOrgSlot failed:", e);
    toast.error("Failed to remove slot");
    return false;
  }
}
