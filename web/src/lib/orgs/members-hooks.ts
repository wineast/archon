"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { OrgRole } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface OrgMemberInfo {
  id: string;
  userId: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: OrgRole;
  createdAt: string;
}

export function useOrgMembers(orgId?: string) {
  const { data, error, isLoading, mutate } = useSWR<OrgMemberInfo[]>(
    orgId ? `/api/orgs/${orgId}/members` : null,
    fetcher
  );

  return {
    members: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function inviteOrgMember(
  orgId: string,
  data: { email: string; role: string },
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/orgs/${orgId}/members`, {
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
    console.warn("inviteOrgMember failed:", e);
    toast.error(msg);
    return null;
  }
}

export async function updateOrgMemberRole(
  orgId: string,
  memberId: string,
  role: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/orgs/${orgId}/members/${memberId}`, {
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
    console.warn("updateOrgMemberRole failed:", e);
    toast.error(msg);
    return null;
  }
}

export async function removeOrgMember(
  orgId: string,
  memberId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/orgs/${orgId}/members/${memberId}`, {
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
    console.warn("removeOrgMember failed:", e);
    toast.error(msg);
    return false;
  }
}

export async function transferOrgOwnership(
  orgId: string,
  targetUserId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/orgs/${orgId}/members/transfer`, {
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
    console.warn("transferOrgOwnership failed:", e);
    toast.error(msg);
    return false;
  }
}
