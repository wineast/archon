import { db } from "@/db";
import { memories, memoryConfigs } from "@/db/schema";
import { eq, and, isNull, or, desc, sql } from "drizzle-orm";
import type { MemoryRow, MemoryConfigRow } from "@/db/schema";
import { generateEmbedding } from "./embedding";

export interface RetrieveMemoriesInput {
  agentId: string;
  userId: string | null;
  sessionId?: string;
  /** Latest user message for semantic retrieval. */
  userMessage?: string;
  /** Org ID for BYOK embedding. */
  orgId?: string | null;
}

export interface RetrievedMemories {
  config: MemoryConfigRow;
  items: MemoryRow[];
}

/** Shared base conditions for memory queries. */
function baseConditions(agentId: string, userId: string | null) {
  return and(
    eq(memories.agentId, agentId),
    isNull(memories.deletedAt),
    or(isNull(memories.expiresAt), sql`${memories.expiresAt} > now()`),
    or(
      isNull(memories.userId),
      userId ? eq(memories.userId, userId) : sql`false`
    )
  );
}

/**
 * Retrieve relevant memories for injection.
 *
 * When a userMessage is provided and embedding succeeds, uses pgvector
 * cosine similarity weighted with importance and recency:
 *   score = similarity * 0.5 + importance * 0.3 + recency * 0.2
 *
 * Falls back to importance DESC, lastAccessedAt DESC when no userMessage
 * is provided or embedding fails.
 */
export async function retrieveMemories(
  input: RetrieveMemoriesInput
): Promise<RetrievedMemories | null> {
  const { agentId, userId, userMessage, orgId } = input;

  const [config] = await db
    .select()
    .from(memoryConfigs)
    .where(eq(memoryConfigs.agentId, agentId))
    .limit(1);

  if (!config || config.injectionMode === "none") return null;

  const limit = config.maxInjectedMemories ?? 10;

  // Attempt semantic retrieval
  let rows: MemoryRow[] | null = null;

  if (userMessage) {
    try {
      const queryEmbedding = await generateEmbedding(userMessage, orgId);
      rows = await semanticRetrieve(agentId, userId, queryEmbedding, limit);
    } catch {
      // Embedding failed — fall through to fallback
    }
  }

  // Fallback: importance + recency ordering
  if (!rows) {
    rows = await fallbackRetrieve(agentId, userId, limit);
  }

  if (rows.length === 0) return { config, items: [] };

  // Non-blocking: update lastAccessedAt for retrieved memories
  const ids = rows.map((r) => r.id);
  db.update(memories)
    .set({ lastAccessedAt: new Date() })
    .where(sql`${memories.id} = ANY(${ids})`)
    .execute()
    .catch((e) =>
      console.error("[memory] failed to update lastAccessedAt:", e)
    );

  return { config, items: rows };
}

/** Semantic retrieval using pgvector cosine similarity. */
async function semanticRetrieve(
  agentId: string,
  userId: string | null,
  queryEmbedding: number[],
  limit: number
): Promise<MemoryRow[]> {
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

  // score = similarity * 0.5 + importance * 0.3 + recency * 0.2
  // similarity = 1 - cosine_distance
  // recency = 1 / (1 + days_since_last_access)
  return db
    .select()
    .from(memories)
    .where(
      and(
        baseConditions(agentId, userId),
        sql`${memories.embedding} IS NOT NULL`
      )
    )
    .orderBy(
      sql`(
        (1 - (${memories.embedding} <=> ${sql.raw(`'${embeddingLiteral}'::vector`)})) * 0.5
        + ${memories.importance} * 0.3
        + (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - COALESCE(${memories.lastAccessedAt}, ${memories.createdAt}))) / 86400.0)) * 0.2
      ) DESC`
    )
    .limit(limit);
}

/** Fallback retrieval: importance DESC, lastAccessedAt DESC. */
async function fallbackRetrieve(
  agentId: string,
  userId: string | null,
  limit: number
): Promise<MemoryRow[]> {
  return db
    .select()
    .from(memories)
    .where(baseConditions(agentId, userId))
    .orderBy(desc(memories.importance), desc(memories.lastAccessedAt))
    .limit(limit);
}
