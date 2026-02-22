"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { SkillRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function skillsApiKey(agentId?: string) {
  return agentId ? `/api/skills?agentId=${agentId}` : null;
}

export function useSkills(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<SkillRow[]>(
    skillsApiKey(agentId),
    fetcher
  );

  return {
    skills: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useSkill(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<SkillRow>(
    id ? `/api/skills/${id}` : null,
    fetcher
  );

  return {
    skill: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createSkill(
  data: {
    key: string;
    name: string;
    description?: string;
    content?: string;
    enabled?: boolean;
    order?: number;
    agentId: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create skill");
    }
    mutate();
    return res.json();
  } catch (e) {
    console.warn("createSkill failed:", e);
    toast.error((e as Error).message || "Failed to create skill");
    return null;
  }
}

export async function updateSkill(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/skills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to save skill");
    }
    mutate();
    return res.json();
  } catch (e) {
    console.warn("updateSkill failed:", e);
    toast.error((e as Error).message || "Failed to save skill");
    return null;
  }
}

export async function toggleSkillEnabled(
  id: string,
  enabled: boolean,
  mutate: () => void
) {
  return updateSkill(id, { enabled }, mutate);
}

export async function toggleSkillsFeature(
  agentId: string,
  enabled: boolean,
  mutateAgent: () => void
) {
  try {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillsEnabled: enabled }),
    });
    if (!res.ok) throw new Error("Failed to toggle skills feature");
    mutateAgent();
  } catch (e) {
    console.warn("toggleSkillsFeature failed:", e);
    toast.error((e as Error).message || "Failed to toggle skills feature");
  }
}

export async function deleteSkill(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/skills/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.warn("deleteSkill failed:", e);
    toast.error("Failed to delete skill");
    return false;
  }
}
