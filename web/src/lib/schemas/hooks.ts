"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { SchemaRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function schemasApiKey(agentId?: string) {
  return agentId ? `/api/schemas?agentId=${agentId}` : null;
}

export function useSchemas(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<WithPoolMeta<SchemaRow>[]>(
    schemasApiKey(agentId),
    fetcher
  );

  return {
    schemas: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createSchema(
  data: {
    agentId: string;
    key: string;
    name: string;
    description?: string;
    parameters?: unknown;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/schemas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("createSchema failed:", e);
    toast.error("Failed to create schema");
    return null;
  }
}

export async function updateSchema(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/schemas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateSchema failed:", e);
    toast.error("Failed to save schema");
    return null;
  }
}

export async function deleteSchema(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/schemas/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.warn("deleteSchema failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete schema");
    return false;
  }
}
