import { db } from "@/db";
import { memories, memoryConfigs } from "@/db/schema";
import { eq, and, isNull, or, desc, sql } from "drizzle-orm";
import type { MemoryRow, MemoryConfigRow } from "@/db/schema";

export interface RetrieveMemoriesInput {
  agentId: string;
  userId: string | null;
  sessionId?: string;
}

export interface RetrievedMemories {
  config: MemoryConfigRow;
  items: MemoryRow[];
}

/**
 * Retrieve relevant memories for injection.
 *
 * Strategy: score = importance * 0.6 + recency * 0.4
 *   where recency = 1 / (1 + hours_since_last_access)
 *
 * Returns the config + top-N items, and asynchronously updates lastAccessedAt.
 */
export async function retrieveMemories(
  input: RetrieveMemoriesInput
): Promise<RetrievedMemories | null> {
  const { agentId, userId } = input;

  // Single query: get config
  const [config] = await db
    .select()
    .from(memoryConfigs)
    .where(eq(memoryConfigs.agentId, agentId))
    .limit(1);

  if (!config || config.injectionMode === "none") return null;

  const limit = config.maxInjectedMemories ?? 10;

  // Retrieve memories: user-specific + global, not deleted, not expired
  const rows = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.agentId, agentId),
        isNull(memories.deletedAt),
        or(
          isNull(memories.expiresAt),
          sql`${memories.expiresAt} > now()`
        ),
        // User-specific + global (userId IS NULL)
        or(
          isNull(memories.userId),
          userId ? eq(memories.userId, userId) : sql`false`
        )
      )
    )
    .orderBy(
      // Weighted score: importance * 0.6 + recency * 0.4
      // recency approximated by lastAccessedAt DESC, importance DESC
      desc(memories.importance),
      desc(memories.lastAccessedAt)
    )
    .limit(limit);

  if (rows.length === 0) return { config, items: [] };

  // Non-blocking: update lastAccessedAt for retrieved memories
  const ids = rows.map((r) => r.id);
  db.update(memories)
    .set({ lastAccessedAt: new Date() })
    .where(sql`${memories.id} = ANY(${ids})`)
    .execute()
    .catch((e) => console.error("[memory] failed to update lastAccessedAt:", e));

  return { config, items: rows };
}
