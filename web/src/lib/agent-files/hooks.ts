"use client";

import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import type { AgentFileRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function agentFilesApiKey(agentId?: string) {
  return agentId ? `/api/agents/${agentId}/files` : null;
}

export function useAgentFiles(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<AgentFileRow[]>(
    agentFilesApiKey(agentId),
    fetcher
  );

  return {
    files: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function uploadAgentFile(
  agentId: string,
  file: File,
  mutate: KeyedMutator<AgentFileRow[]>
) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/agents/${agentId}/files`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Upload failed");
    }
    mutate();
    return await res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to upload file";
    toast.error(msg);
    return null;
  }
}

export async function deleteAgentFile(
  agentId: string,
  fileId: string,
  mutate: KeyedMutator<AgentFileRow[]>
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/files/${fileId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.warn("deleteAgentFile failed:", e);
    toast.error("Failed to delete file");
    return false;
  }
}
