"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ObjectTypeRow, ObjectRelationRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Object Types ─────────── */

export function objectTypesApiKey(agentId?: string) {
  return agentId ? `/api/object-types?agentId=${agentId}` : null;
}

export function useObjectTypes(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ObjectTypeRow[]>(
    objectTypesApiKey(agentId),
    fetcher
  );

  return {
    objectTypes: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createObjectType(
  data: {
    agentId: string;
    key: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    schemaId?: string | null;
    order?: number;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/object-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createObjectType failed:", e);
    toast.error("Failed to create object type");
    return null;
  }
}

export async function updateObjectType(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/object-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateObjectType failed:", e);
    toast.error("Failed to save object type");
    return null;
  }
}

export async function deleteObjectType(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/object-types/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    return true;
  } catch (e) {
    console.error("deleteObjectType failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete object type");
    return false;
  }
}

/* ─────────── Object Relations ─────────── */

export function objectRelationsApiKey(agentId?: string) {
  return agentId ? `/api/object-relations?agentId=${agentId}` : null;
}

export function useObjectRelations(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ObjectRelationRow[]>(
    objectRelationsApiKey(agentId),
    fetcher
  );

  return {
    objectRelations: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createObjectRelation(
  data: {
    agentId: string;
    key: string;
    name: string;
    description?: string;
    sourceTypeId: string;
    targetTypeId: string;
    relationType: string;
    inverseName?: string;
    order?: number;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/object-relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createObjectRelation failed:", e);
    toast.error("Failed to create relation");
    return null;
  }
}

export async function updateObjectRelation(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/object-relations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateObjectRelation failed:", e);
    toast.error("Failed to save relation");
    return null;
  }
}

export async function deleteObjectRelation(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/object-relations/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    return true;
  } catch (e) {
    console.error("deleteObjectRelation failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete relation");
    return false;
  }
}
