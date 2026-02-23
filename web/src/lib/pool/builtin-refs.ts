import { tools, components, wikiDocuments, agentResourceRefs } from "@/db/schema";
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
 * Ensure an agent has references to all builtin pool components.
 * Called when creating any agent (slot or user-created).
 */
export async function ensureBuiltinComponentRefs(
  db: DbLike,
  agentId: string,
  versionId: string,
): Promise<void> {
  const poolComponents = await db
    .select({ id: components.id })
    .from(components)
    .where(and(isNull(components.agentId), eq(components.origin, "builtin")));

  for (const pc of poolComponents) {
    await db
      .insert(agentResourceRefs)
      .values({
        agentId,
        versionId,
        resourceType: "component",
        resourceId: pc.id,
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
