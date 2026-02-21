import { db } from "@/db";
import { orgApiKeys } from "@/db/schema";
import type { ByokProvider } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

/* ─────────── Cache ─────────── */

const TTL_MS = 60_000;

interface CacheEntry {
  value: string | null;
  at: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(orgId: string, provider: string): string {
  return `${orgId}:${provider}`;
}

/* ─────────── Public API ─────────── */

/**
 * Get the decrypted API key for an org + provider.
 * Returns null if not configured or inactive.
 * Results are cached for 60s (including null).
 */
export async function getOrgApiKey(
  orgId: string,
  provider: ByokProvider
): Promise<string | null> {
  const key = cacheKey(orgId, provider);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const [row] = await db
    .select({ encryptedKey: orgApiKeys.encryptedKey })
    .from(orgApiKeys)
    .where(
      and(
        eq(orgApiKeys.orgId, orgId),
        eq(orgApiKeys.provider, provider),
        eq(orgApiKeys.isActive, true)
      )
    )
    .limit(1);

  const value = row ? decrypt(row.encryptedKey) : null;
  cache.set(key, { value, at: now });
  return value;
}

/**
 * Invalidate cache after CRUD operations.
 * If provider is omitted, all providers for the org are invalidated.
 */
export function invalidateOrgApiKeyCache(
  orgId: string,
  provider?: ByokProvider
): void {
  if (provider) {
    cache.delete(cacheKey(orgId, provider));
  } else {
    for (const k of cache.keys()) {
      if (k.startsWith(`${orgId}:`)) {
        cache.delete(k);
      }
    }
  }
}
