import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";

const TTL_MS = 60_000;

interface CacheEntry {
  value: number;
  at: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get org credit balance with 60s TTL cache.
 */
export async function getOrgCreditBalance(orgId: string): Promise<number> {
  const now = Date.now();
  const cached = cache.get(orgId);
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const [row] = await db
    .select({ creditBalanceUSD: orgs.creditBalanceUSD })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  const value = row?.creditBalanceUSD ?? 0;
  cache.set(orgId, { value, at: now });
  return value;
}

/**
 * Invalidate credit balance cache after mutations.
 */
export function invalidateOrgCreditCache(orgId: string): void {
  cache.delete(orgId);
}
