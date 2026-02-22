"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { AgentRole } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface MemberInfo {
  id: string;
  userId: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: AgentRole;
  createdAt: string;
}

export function membersApiKey(agentId?: string) {
  return agentId ? `/api/agents/${agentId}/members` : null;
}

export function useMembers(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<MemberInfo[]>(
    membersApiKey(agentId),
    fetcher
  );

  return {
    members: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function inviteMember(
  agentId: string,
  data: { email: string; role: string },
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to invite");
    }
    mutate();
    return res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "邀请成员失败";
    console.warn("inviteMember failed:", e);
    toast.error(msg);
    return null;
  }
}

export async function updateMemberRole(
  agentId: string,
  memberId: string,
  role: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to update role");
    }
    mutate();
    return res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修改角色失败";
    console.warn("updateMemberRole failed:", e);
    toast.error(msg);
    return null;
  }
}

export async function removeMember(
  agentId: string,
  memberId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to remove");
    }
    mutate();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "移除成员失败";
    console.warn("removeMember failed:", e);
    toast.error(msg);
    return false;
  }
}

export async function transferOwnership(
  agentId: string,
  targetUserId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/members/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to transfer");
    }
    mutate();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "转让所有权失败";
    console.warn("transferOwnership failed:", e);
    toast.error(msg);
    return false;
  }
}
