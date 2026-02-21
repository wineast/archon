"use client";

import useSWR, { type KeyedMutator, useSWRConfig } from "swr";
import { toast } from "sonner";

export type ResourceType =
  | "tool"
  | "function"
  | "component"
  | "schema"
  | "dataset"
  | "wikiDocument"
  | "modelConfig"
  | "evalCase"
  | "evalJudgeConfig"
  | "objectType"
  | "objectRelation"
  | "skill";

export interface TrashedItem {
  id: string;
  key: string;
  name: string;
  deletedAt: string;
}

export type TrashData = {
  [type in ResourceType]?: TrashedItem[];
} & { totalCount: number };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTrash(agentId?: string) {
  const key = agentId ? `/api/agents/${agentId}/trash` : null;
  const { data, error, isLoading, mutate } = useSWR<TrashData>(key, fetcher);

  return {
    data: data ?? null,
    totalCount: (data?.totalCount as unknown as number) ?? 0,
    isLoading,
    error,
    mutate,
  };
}

export async function restoreResources(
  agentId: string,
  type: ResourceType,
  ids: string[],
  trashMutate: KeyedMutator<TrashData>,
  globalMutate: ReturnType<typeof useSWRConfig>["mutate"]
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ids }),
    });
    if (!res.ok) throw new Error(await res.text());
    trashMutate();
    // Revalidate resource lists
    globalMutate(
      (key) => typeof key === "string" && key.includes(`agentId=${agentId}`),
      undefined,
      { revalidate: true }
    );
    toast.success("已恢复");
    return true;
  } catch (e) {
    console.error("restoreResources failed:", e);
    toast.error("恢复失败");
    return false;
  }
}

export async function permanentDeleteResources(
  agentId: string,
  type: ResourceType,
  ids: string[],
  trashMutate: KeyedMutator<TrashData>
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/trash`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ids }),
    });
    if (!res.ok) throw new Error(await res.text());
    trashMutate();
    toast.success("已永久删除");
    return true;
  } catch (e) {
    console.error("permanentDeleteResources failed:", e);
    toast.error("永久删除失败");
    return false;
  }
}

export async function clearTrash(
  agentId: string,
  trashMutate: KeyedMutator<TrashData>
) {
  try {
    const res = await fetch(`/api/agents/${agentId}/trash/all`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    trashMutate();
    toast.success("回收站已清空");
    return true;
  } catch (e) {
    console.error("clearTrash failed:", e);
    toast.error("清空回收站失败");
    return false;
  }
}
