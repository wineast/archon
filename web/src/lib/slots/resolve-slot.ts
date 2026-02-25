import { db as appDb } from "@/db";
import { agentSlots, orgSlots, modelConfigs } from "@/db/schema";
import type { AgentSlotKey, OrgSlotKey } from "@/db/schema";
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

function getCached(key: string): ResolvedSlot | null {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.value;
  return null;
}

function setCache(key: string, value: ResolvedSlot): void {
  cache.set(key, { value, at: Date.now() });
}

/* ─────────── Public API ─────────── */

/**
 * Resolve an agent-level slot.
 *
 * Looks up agentSlots(agentId, slotKey) for a binding.
 * Returns the resolved agent's active model config, or null agentId if not configured.
 * Results are cached for 60s.
 */
export async function resolveAgentSlot(
  agentId: string,
  slotKey: AgentSlotKey
): Promise<ResolvedSlot> {
  const key = `agent:${agentId}:${slotKey}`;
  const cached = getCached(key);
  if (cached) return cached;

  const def = SLOT_DEFS[slotKey];

  const [binding] = await appDb
    .select({ targetAgentId: agentSlots.targetAgentId })
    .from(agentSlots)
    .where(and(eq(agentSlots.agentId, agentId), eq(agentSlots.slotKey, slotKey)))
    .limit(1);

  if (binding) {
    const mc = await getActiveModelConfig(binding.targetAgentId);
    const value: ResolvedSlot = {
      agentId: binding.targetAgentId,
      model: mc?.model || def.defaultModel,
      temperature: mc?.temperature ?? def.defaultTemperature,
    };
    setCache(key, value);
    return value;
  }

  // Don't cache null results — slot may be configured later and we want
  // the next resolve call to pick it up immediately.
  return { agentId: null, model: "", temperature: 0 };
}

/**
 * Resolve an org-level slot.
 *
 * Looks up orgSlots(orgId, slotKey) for a binding.
 * Returns the resolved agent's active model config, or null agentId if not configured.
 * Results are cached for 60s.
 */
export async function resolveOrgSlot(
  orgId: string,
  slotKey: OrgSlotKey
): Promise<ResolvedSlot> {
  const key = `org:${orgId}:${slotKey}`;
  const cached = getCached(key);
  if (cached) return cached;

  const def = SLOT_DEFS[slotKey];

  const [binding] = await appDb
    .select({ targetAgentId: orgSlots.targetAgentId })
    .from(orgSlots)
    .where(and(eq(orgSlots.orgId, orgId), eq(orgSlots.slotKey, slotKey)))
    .limit(1);

  if (binding) {
    const mc = await getActiveModelConfig(binding.targetAgentId);
    const value: ResolvedSlot = {
      agentId: binding.targetAgentId,
      model: mc?.model || def.defaultModel,
      temperature: mc?.temperature ?? def.defaultTemperature,
    };
    setCache(key, value);
    return value;
  }

  const value: ResolvedSlot = { agentId: null, model: "", temperature: 0 };
  setCache(key, value);
  return value;
}

/**
 * Invalidate slot resolution caches.
 * Call without args to clear all, or with id to clear specific caches (matches by id prefix).
 */
export function invalidateSlotCache(id?: string): void {
  if (id) {
    for (const key of cache.keys()) {
      if (key.includes(`:${id}:`)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
