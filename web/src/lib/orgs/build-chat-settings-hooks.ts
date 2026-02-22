import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { toast } from "sonner";

export interface OrgBuildChatSettingsData {
  buildChatModel: string | null;
  buildChatTemperature: number | null;
  assistModel: string | null;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json();
  });

export function useOrgBuildChatSettings(orgId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<OrgBuildChatSettingsData>(
    orgId ? `/api/orgs/${orgId}/build-chat-settings` : null,
    fetcher
  );

  return {
    settings: data ?? null,
    error,
    isLoading,
    mutate,
  };
}

export async function updateOrgBuildChatSettings(
  orgId: string,
  fields: {
    buildChatModel?: string | null;
    buildChatTemperature?: number | null;
    assistModel?: string | null;
  },
  mutate: KeyedMutator<OrgBuildChatSettingsData>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/orgs/${orgId}/build-chat-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to update settings");
    }
    await mutate();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存设置失败";
    console.error("updateOrgBuildChatSettings failed:", e);
    toast.error(msg);
    return false;
  }
}
