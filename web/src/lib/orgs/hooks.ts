"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { OrgRow, OrgRole } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type OrgWithRole = OrgRow & { myRole: OrgRole | null };

export function useOrgs() {
  const { data, error, isLoading, mutate } = useSWR<OrgWithRole[]>(
    "/api/orgs",
    fetcher
  );

  return {
    orgs: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createOrg(
  data: { name: string; slug?: string },
  mutate: KeyedMutator<OrgWithRole[]>
) {
  try {
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createOrg failed:", e);
    toast.error("创建组织失败");
    return null;
  }
}

export async function updateOrg(
  id: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<OrgWithRole[]>
) {
  try {
    const res = await fetch(`/api/orgs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateOrg failed:", e);
    toast.error("更新组织失败");
    return null;
  }
}

export async function deleteOrg(
  id: string,
  mutate: KeyedMutator<OrgWithRole[]>
) {
  try {
    const res = await fetch(`/api/orgs/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to delete");
    }
    mutate();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除组织失败";
    console.error("deleteOrg failed:", e);
    toast.error(msg);
    return false;
  }
}
