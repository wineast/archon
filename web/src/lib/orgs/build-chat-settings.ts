import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";

/* ─────────── Defaults ─────────── */

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_TEMPERATURE = 0.3;
export const DEFAULT_ASSIST_MODEL = "anthropic/claude-sonnet-4";

/* ─────────── Cache ─────────── */

const TTL_MS = 60_000;

interface CacheEntry {
  value: { buildChatModel: string; buildChatTemperature: number; assistModel: string };
  at: number;
}

const cache = new Map<string, CacheEntry>();

/* ─────────── Public API ─────────── */

/**
 * Get the build-chat model settings for an org.
 * Nullable fields fall back to application defaults.
 * Results are cached for 60s.
 */
export async function getOrgBuildChatSettings(
  orgId: string
): Promise<{ buildChatModel: string; buildChatTemperature: number; assistModel: string }> {
  const now = Date.now();
  const cached = cache.get(orgId);
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const [row] = await db
    .select({
      buildChatModel: orgs.buildChatModel,
      buildChatTemperature: orgs.buildChatTemperature,
      assistModel: orgs.assistModel,
    })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  const value = {
    buildChatModel: row?.buildChatModel ?? DEFAULT_MODEL,
    buildChatTemperature: row?.buildChatTemperature ?? DEFAULT_TEMPERATURE,
    assistModel: row?.assistModel ?? DEFAULT_ASSIST_MODEL,
  };

  cache.set(orgId, { value, at: now });
  return value;
}

/**
 * Get the assist model for an org (shortcut).
 */
export async function getOrgAssistModel(orgId: string): Promise<string> {
  const settings = await getOrgBuildChatSettings(orgId);
  return settings.assistModel;
}

/**
 * Invalidate cache after settings update.
 */
export function invalidateOrgBuildChatSettingsCache(orgId: string): void {
  cache.delete(orgId);
}
