"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { InvitationCodeRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useInvitationCodes() {
  const { data, error, isLoading, mutate } = useSWR<InvitationCodeRow[]>(
    "/api/admin/invitation-codes",
    fetcher
  );

  return {
    codes: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createInvitationCode(
  fields: { label?: string; maxUses?: number | null; expiresAt?: string | null },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/admin/invitation-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create invitation code");
    }
    mutate();
    return res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建邀请码失败";
    console.error("createInvitationCode failed:", e);
    toast.error(msg);
    return null;
  }
}

export async function updateInvitationCode(
  id: string,
  fields: { label?: string; maxUses?: number | null; isActive?: boolean; expiresAt?: string | null },
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/admin/invitation-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to update invitation code");
    }
    mutate();
    return res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新邀请码失败";
    console.error("updateInvitationCode failed:", e);
    toast.error(msg);
    return null;
  }
}

export async function deleteInvitationCode(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/admin/invitation-codes/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to delete invitation code");
    }
    mutate();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除邀请码失败";
    console.error("deleteInvitationCode failed:", e);
    toast.error(msg);
    return false;
  }
}
