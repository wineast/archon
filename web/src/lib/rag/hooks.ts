"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { AgentRow, RagConfigRow, RagDocumentRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Feature Toggle ─────────── */

export async function toggleRagFeature(
  agentId: string,
  enabled: boolean,
  mutateAgent: KeyedMutator<AgentRow>
) {
  try {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ragEnabled: enabled }),
    });
    if (!res.ok) throw new Error(await res.text());
    mutateAgent();
  } catch (e) {
    console.warn("toggleRagFeature failed:", e);
    toast.error("Failed to toggle RAG feature");
  }
}

/* ─────────── RAG Config (1:1) ─────────── */

export function ragConfigApiKey(agentId?: string) {
  return agentId ? `/api/rag-configs?agentId=${agentId}` : null;
}

export function useRagConfig(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<RagConfigRow | null>(
    ragConfigApiKey(agentId),
    fetcher
  );

  return {
    config: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function updateRagConfig(
  id: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<RagConfigRow | null>
) {
  try {
    const res = await fetch(`/api/rag-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateRagConfig failed:", e);
    toast.error("Failed to save RAG config");
    return null;
  }
}

/* ─────────── RAG Documents (list) ─────────── */

export function ragDocumentsApiKey(agentId?: string) {
  return agentId ? `/api/rag-documents?agentId=${agentId}` : null;
}

export function useRagDocuments(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<RagDocumentRow[]>(
    ragDocumentsApiKey(agentId),
    fetcher
  );

  return {
    documents: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function uploadRagDocument(
  agentId: string,
  file: File,
  mutate: () => void
) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("agentId", agentId);

    const res = await fetch("/api/rag-documents", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Upload failed");
    }
    mutate();
    return res.json();
  } catch (e) {
    console.warn("uploadRagDocument failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to upload document");
    return null;
  }
}

export async function deleteRagDocument(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/rag-documents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteRagDocument failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete document");
    return false;
  }
}
