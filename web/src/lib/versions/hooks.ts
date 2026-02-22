"use client";

import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import type { VersionListItem } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function versionsApiKey(agentId?: string) {
  return agentId ? `/api/agents/${agentId}/versions` : null;
}

export function useVersions(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<VersionListItem[]>(
    versionsApiKey(agentId),
    fetcher
  );

  return {
    versions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createVersion(
  agentId: string,
  data: { version: string; changelog: string },
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to create version");
    }
    mutate();
    return res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create version";
    toast.error(msg);
    return null;
  }
}

/**
 * Switch the editing version. This saves current data to the current version
 * and restores the target version's data into the live tables.
 */
export async function switchVersion(
  agentId: string,
  targetVersionId: string,
  revalidateAll: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/versions/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetVersionId }),
    });
    if (!res.ok) throw new Error(await res.text());
    // Revalidate all SWR caches so panels refresh with new data
    revalidateAll();
    return true;
  } catch (e) {
    console.warn("switchVersion failed:", e);
    toast.error("Failed to switch version");
    return false;
  }
}

export async function publishVersion(
  agentId: string,
  versionId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(
      `/api/agents/${agentId}/versions/${versionId}/publish`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("publishVersion failed:", e);
    toast.error("Failed to publish version");
    return false;
  }
}

export async function rollbackVersion(
  agentId: string,
  versionId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(
      `/api/agents/${agentId}/versions/${versionId}/rollback`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("rollbackVersion failed:", e);
    toast.error("Failed to rollback version");
    return false;
  }
}

export async function deleteVersion(
  agentId: string,
  versionId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(
      `/api/agents/${agentId}/versions/${versionId}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteVersion failed:", e);
    toast.error("Failed to delete version");
    return false;
  }
}
