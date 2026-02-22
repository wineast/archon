import { db } from "@/db";
import { agents, modelConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { BUILTIN_AGENT_DEFS, type ReservedSlug } from "./constants";

/* ─────────── Cache ─────────── */

const TTL_MS = 60_000;

interface CacheEntry {
  value: BuiltinAgentConfig;
  at: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(orgId: string, slug: ReservedSlug): string {
  return `${orgId}:${slug}`;
}

/* ─────────── Types ─────────── */

export interface BuiltinAgentConfig {
  agentId: string;
  model: string;
  temperature: number;
}

/* ─────────── Public API ─────────── */

/**
 * Get the active model config for a builtin agent in an org.
 * Falls back to the builtin agent's defaults if no active config is found.
 * Results are cached for 60s.
 */
export async function getBuiltinAgentConfig(
  orgId: string,
  slug: ReservedSlug
): Promise<BuiltinAgentConfig> {
  const key = cacheKey(orgId, slug);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const def = BUILTIN_AGENT_DEFS[slug];

  // Find the builtin agent
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.orgId, orgId), eq(agents.slug, slug)))
    .limit(1);

  if (!agent) {
    // Agent not yet created — return defaults
    const value: BuiltinAgentConfig = {
      agentId: "",
      model: def.defaultModel,
      temperature: def.defaultTemperature,
    };
    cache.set(key, { value, at: now });
    return value;
  }

  // Find active model config
  const [config] = await db
    .select({ modelId: modelConfigs.modelId, temperature: modelConfigs.temperature })
    .from(modelConfigs)
    .where(and(eq(modelConfigs.agentId, agent.id), eq(modelConfigs.isActive, true)))
    .limit(1);

  const value: BuiltinAgentConfig = {
    agentId: agent.id,
    model: config?.modelId || def.defaultModel,
    temperature: config?.temperature ?? def.defaultTemperature,
  };

  cache.set(key, { value, at: now });
  return value;
}

/**
 * Invalidate all builtin agent config caches for an org.
 */
export function invalidateBuiltinAgentConfigCache(orgId?: string): void {
  if (orgId) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${orgId}:`)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
