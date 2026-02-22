import { tools, wikiDocuments, agentResourceRefs } from "@/db/schema";
import { and, isNull, eq } from "drizzle-orm";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * Ensure a build-chat agent has references to all builtin pool tools.
 * Called during org defaults setup.
 */
export async function ensureBuiltinToolRefs(
  db: DbLike,
  buildChatAgentId: string,
  versionId: string,
): Promise<void> {
  const poolTools = await db
    .select({ id: tools.id })
    .from(tools)
    .where(and(isNull(tools.agentId), eq(tools.origin, "builtin")));

  for (const pt of poolTools) {
    await db
      .insert(agentResourceRefs)
      .values({
        agentId: buildChatAgentId,
        versionId,
        resourceType: "tool",
        resourceId: pt.id,
        enabled: true,
      })
      .onConflictDoNothing();
  }
}

/**
 * Ensure an agent has references to all builtin pool wiki documents.
 * Called during org defaults setup for the assist slot.
 */
export async function ensureBuiltinWikiRefs(
  db: DbLike,
  agentId: string,
  versionId: string,
): Promise<void> {
  const poolDocs = await db
    .select({ id: wikiDocuments.id })
    .from(wikiDocuments)
    .where(and(isNull(wikiDocuments.agentId), eq(wikiDocuments.origin, "builtin")));

  for (const doc of poolDocs) {
    await db
      .insert(agentResourceRefs)
      .values({
        agentId,
        versionId,
        resourceType: "wiki",
        resourceId: doc.id,
        enabled: true,
      })
      .onConflictDoNothing();
  }
}
