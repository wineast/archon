import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { toast } from "sonner";

export interface OrgApiKeyItem {
  id: string;
  provider: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json();
  });

export function useOrgApiKeys(orgId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<OrgApiKeyItem[]>(
    orgId ? `/api/orgs/${orgId}/api-keys` : null,
    fetcher
  );

  return {
    keys: data ?? [],
    error,
    isLoading,
    mutate,
  };
}

export async function saveOrgApiKey(
  orgId: string,
  provider: string,
  apiKey: string,
  mutate: KeyedMutator<OrgApiKeyItem[]>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/orgs/${orgId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "保存失败");
      return false;
    }
    await mutate();
    return true;
  } catch (e) {
    toast.error("保存失败");
    return false;
  }
}

export async function deleteOrgApiKey(
  orgId: string,
  keyId: string,
  mutate: KeyedMutator<OrgApiKeyItem[]>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/orgs/${orgId}/api-keys/${keyId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "删除失败");
      return false;
    }
    await mutate();
    return true;
  } catch (e) {
    toast.error("删除失败");
    return false;
  }
}
