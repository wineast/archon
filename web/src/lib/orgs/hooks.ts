"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { OrgRow, OrgRole } from "@/db/schema";
import { useOrgStore } from "@/stores/org-store";

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
): Promise<OrgWithRole | null> {
  try {
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const created: OrgWithRole = await res.json();
    mutate();
    return created;
  } catch (e) {
    console.warn("createOrg failed:", e);
    toast.error("创建组织失败");
    return null;
  }
}

/**
 * 双向同步 URL `?org=<slug>` ↔ Zustand `currentOrgId`
 * - mount 时：URL → Zustand
 * - currentOrgId 变化时：Zustand → URL
 */
export function useOrgParam(orgs: OrgWithRole[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentOrgId, setCurrentOrgId } = useOrgStore();
  const initializedRef = useRef(false);

  // URL → Zustand（仅 mount 时执行一次）
  useEffect(() => {
    if (initializedRef.current || orgs.length === 0) return;
    initializedRef.current = true;

    const slugParam = searchParams.get("org");
    if (!slugParam) return;

    const matched = orgs.find((o) => o.slug === slugParam);
    if (matched && matched.id !== currentOrgId) {
      setCurrentOrgId(matched.id);
    }
  }, [orgs, searchParams, currentOrgId, setCurrentOrgId]);

  // Zustand → URL
  useEffect(() => {
    if (!currentOrgId || orgs.length === 0) return;

    const currentOrg = orgs.find((o) => o.id === currentOrgId);
    if (!currentOrg) return;

    const slugParam = searchParams.get("org");
    if (slugParam === currentOrg.slug) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("org", currentOrg.slug);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [currentOrgId, orgs, searchParams, router]);
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
    console.warn("updateOrg failed:", e);
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
    console.warn("deleteOrg failed:", e);
    toast.error(msg);
    return false;
  }
}
