import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { toast } from "sonner";
import type { OrgCreditTransactionRow } from "@/db/schema";

export interface OrgCreditsData {
  balance: number;
  transactions: OrgCreditTransactionRow[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json();
  });

export function useOrgCredits(orgId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<OrgCreditsData>(
    orgId ? `/api/orgs/${orgId}/credits` : null,
    fetcher
  );

  return {
    balance: data?.balance ?? 0,
    transactions: data?.transactions ?? [],
    error,
    isLoading,
    mutate,
  };
}

export async function purchaseCredits(
  orgId: string,
  amount: number,
  mutate: KeyedMutator<OrgCreditsData>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/orgs/${orgId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "充值失败");
      return false;
    }
    await mutate();
    return true;
  } catch {
    toast.error("充值失败");
    return false;
  }
}
