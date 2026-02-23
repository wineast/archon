import { db as appDb } from "@/db";
import { agentSlotOverrides, modelConfigs } from "@/db/schema";
import type { SlotKey } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SLOT_DEFS } from "./constants";

/* ─────────── Types ─────────── */

export interface ResolvedSlot {
  agentId: string | null;
  model: string;
  temperature: number;
}

/* ─────────── Cache ─────────── */

const TTL_MS = 60_000;

interface CacheEntry {
  value: ResolvedSlot;
  at: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(agentId: string, slotKey: SlotKey): string {
  return `${agentId}:${slotKey}`;
}

/* ─────────── Internal helpers ─────────── */

async function getActiveModelConfig(agentId: string): Promise<{ model: string; temperature: number } | null> {
  const [config] = await appDb
    .select({ modelId: modelConfigs.modelId, temperature: modelConfigs.temperature })
    .from(modelConfigs)
    .where(and(eq(modelConfigs.agentId, agentId), eq(modelConfigs.isActive, true)))
    .limit(1);

  if (!config) return null;
  return { model: config.modelId, temperature: config.temperature };
}

/* ─────────── Public API ─────────── */

/**
 * Resolve a slot for a given agent.
 *
 * Resolution order:
 * 1. agentSlotOverrides (agent-level binding)
 * 2. Not configured (return agentId: null)
 *
 * Returns the resolved agent's active model config, or null agentId if not configured.
 * Results are cached for 60s.
 */
export async function resolveSlot(
  agentId: string,
  slotKey: SlotKey
): Promise<ResolvedSlot> {
  const key = cacheKey(agentId, slotKey);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const def = SLOT_DEFS[slotKey];

  // 1. Check agent-level binding
  const [override] = await appDb
    .select({ targetAgentId: agentSlotOverrides.targetAgentId })
    .from(agentSlotOverrides)
    .where(and(eq(agentSlotOverrides.agentId, agentId), eq(agentSlotOverrides.slotKey, slotKey)))
    .limit(1);

  if (override) {
    const mc = await getActiveModelConfig(override.targetAgentId);
    const value: ResolvedSlot = {
      agentId: override.targetAgentId,
      model: mc?.model || def.defaultModel,
      temperature: mc?.temperature ?? def.defaultTemperature,
    };
    cache.set(key, { value, at: now });
    return value;
  }

  // 2. Not configured
  const value: ResolvedSlot = {
    agentId: null,
    model: "",
    temperature: 0,
  };
  cache.set(key, { value, at: now });
  return value;
}

/**
 * Invalidate slot resolution caches.
 * Call without args to clear all, or with agentId to clear specific agent's caches.
 */
export function invalidateSlotCache(agentId?: string): void {
  if (agentId) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${agentId}:`)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
