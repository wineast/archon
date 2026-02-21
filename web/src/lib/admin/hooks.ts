"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { User } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAdminUsers() {
  const { data, error, isLoading, mutate } = useSWR<User[]>(
    "/api/admin/users",
    fetcher
  );

  return {
    users: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function updateUserRole(
  userId: string,
  platformRole: "user" | "super_admin",
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformRole }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to update role");
    }
    mutate();
    return res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修改用户角色失败";
    console.error("updateUserRole failed:", e);
    toast.error(msg);
    return null;
  }
}
