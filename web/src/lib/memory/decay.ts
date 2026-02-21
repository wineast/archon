import { db } from "@/db";
import { agents, memories, memoryConfigs } from "@/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

const HIGH_IMPORTANCE_THRESHOLD = 0.8;
const HIGH_IMPORTANCE_MULTIPLIER = 2;

export interface DecayResult {
  deletedCount: number;
  agentCount: number;
}

/**
 * Soft-delete memories that have exceeded their decay period.
 *
 * For each agent where memoryEnabled=true AND decayEnabled=true:
 *  - Normal memories: soft-delete if lastAccessedAt < now - decayDays
 *  - High-importance (>= 0.8): soft-delete if lastAccessedAt < now - decayDays * 2
 *
 * Only processes memories that are not already soft-deleted.
 */
export async function decayMemories(): Promise<DecayResult> {
  // Find all agents with decay enabled
  const configs = await db
    .select({
      agentId: memoryConfigs.agentId,
      decayDays: memoryConfigs.decayDays,
    })
    .from(memoryConfigs)
    .innerJoin(agents, eq(agents.id, memoryConfigs.agentId))
    .where(
      and(
        eq(agents.memoryEnabled, true),
        eq(memoryConfigs.decayEnabled, true),
        isNull(agents.deletedAt)
      )
    );

  if (configs.length === 0) {
    return { deletedCount: 0, agentCount: 0 };
  }

  let totalDeleted = 0;
  let agentCount = 0;

  const now = new Date();

  for (const cfg of configs) {
    const normalCutoff = new Date(
      now.getTime() - cfg.decayDays * 24 * 60 * 60 * 1000
    );
    const highImportanceCutoff = new Date(
      now.getTime() -
        cfg.decayDays * HIGH_IMPORTANCE_MULTIPLIER * 24 * 60 * 60 * 1000
    );

    // Soft-delete normal-importance memories past their decay period
    const normalResult = await db
      .update(memories)
      .set({ deletedAt: now })
      .where(
        and(
          eq(memories.agentId, cfg.agentId!),
          isNull(memories.deletedAt),
          lt(memories.importance, HIGH_IMPORTANCE_THRESHOLD),
          lt(memories.lastAccessedAt, normalCutoff)
        )
      )
      .returning({ id: memories.id });

    // Soft-delete high-importance memories past their extended decay period
    const highResult = await db
      .update(memories)
      .set({ deletedAt: now })
      .where(
        and(
          eq(memories.agentId, cfg.agentId!),
          isNull(memories.deletedAt),
          sql`${memories.importance} >= ${HIGH_IMPORTANCE_THRESHOLD}`,
          lt(memories.lastAccessedAt, highImportanceCutoff)
        )
      )
      .returning({ id: memories.id });

    const agentDeleted = normalResult.length + highResult.length;
    if (agentDeleted > 0) {
      totalDeleted += agentDeleted;
      agentCount++;
    }
  }

  return { deletedCount: totalDeleted, agentCount };
}
