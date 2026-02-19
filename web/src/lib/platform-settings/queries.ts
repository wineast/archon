import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEFAULTS = {
  buildChatModel: "anthropic:claude-sonnet-4-20250514",
  buildChatTemperature: 0.3,
} as const;

const TTL_MS = 60_000;

let cached: { buildChatModel: string; buildChatTemperature: number } | null = null;
let cachedAt = 0;

export async function getPlatformSettings() {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;

  const row = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, "singleton"))
    .then((rows) => rows[0] ?? null);

  cached = {
    buildChatModel: row?.buildChatModel ?? DEFAULTS.buildChatModel,
    buildChatTemperature: row?.buildChatTemperature ?? DEFAULTS.buildChatTemperature,
  };
  cachedAt = now;
  return cached;
}

export function invalidatePlatformSettingsCache() {
  cached = null;
  cachedAt = 0;
}
