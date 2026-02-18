"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { LookupTableRow, LookupEntryRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function lookupTablesApiKey(agentId?: string, include?: string) {
  if (!agentId) return null;
  const params = new URLSearchParams({ agentId });
  if (include) params.set("include", include);
  return `/api/lookup-tables?${params}`;
}

export function useLookupTables(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<LookupTableRow[]>(
    lookupTablesApiKey(agentId),
    fetcher
  );

  return {
    tables: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export type LookupTableWithEntries = LookupTableRow & {
  entries: LookupEntryRow[];
};

export function useLookupTablesWithEntries(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<LookupTableWithEntries[]>(
    lookupTablesApiKey(agentId, "entries"),
    fetcher
  );

  return {
    tables: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useLookupTable(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<LookupTableWithEntries>(
    id ? `/api/lookup-tables/${id}` : null,
    fetcher
  );

  return {
    table: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createLookupTable(
  data: { key: string; name: string; description?: string; agentId: string },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/lookup-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createLookupTable failed:", e);
    toast.error("Failed to create lookup table");
    return null;
  }
}

export async function updateLookupTable(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/lookup-tables/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateLookupTable failed:", e);
    toast.error("Failed to save lookup table");
    return null;
  }
}

export async function deleteLookupTable(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/lookup-tables/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteLookupTable failed:", e);
    toast.error("Failed to delete lookup table");
    return false;
  }
}

export async function saveEntries(
  tableId: string,
  entries: Array<{
    value: string;
    label?: string;
    metadata?: Record<string, unknown> | null;
    order?: number;
  }>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/lookup-tables/${tableId}/entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entries),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("saveEntries failed:", e);
    toast.error("Failed to save entries");
    return null;
  }
}

export async function createEntry(
  tableId: string,
  data: {
    value: string;
    label?: string;
    metadata?: Record<string, unknown>;
    order?: number;
  },
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/lookup-tables/${tableId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createEntry failed:", e);
    toast.error("Failed to create entry");
    return null;
  }
}

export async function updateEntry(
  tableId: string,
  entryId: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(
      `/api/lookup-tables/${tableId}/entries/${entryId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateEntry failed:", e);
    toast.error("Failed to update entry");
    return null;
  }
}

export async function deleteEntry(
  tableId: string,
  entryId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(
      `/api/lookup-tables/${tableId}/entries/${entryId}`,
      {
        method: "DELETE",
      }
    );
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteEntry failed:", e);
    toast.error("Failed to delete entry");
    return false;
  }
}
