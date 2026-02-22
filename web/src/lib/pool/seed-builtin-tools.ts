import { tools, agentResourceRefs } from "@/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { buildAllTools } from "@/lib/build-chat/tools";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * Ensure all code-defined build-chat tools exist as builtin pool resources
 * (agentId = NULL, origin = "builtin").
 * Idempotent — uses onConflictDoNothing.
 */
export async function ensureBuiltinPoolTools(db: DbLike): Promise<void> {
  // Use a dummy agentId — we only need the tool metadata (key + description)
  const allTools = buildAllTools("00000000-0000-0000-0000-000000000000");

  const rows = Object.entries(allTools).map(([key, t]) => ({
    agentId: null as unknown as undefined,
    key,
    name: key,
    description: (t as { description?: string }).description ?? "",
    origin: "builtin" as const,
    isSystem: true,
    enabled: true,
    handler: null,
    executionTarget: "server" as const,
  }));

  if (rows.length > 0) {
    await db.insert(tools).values(rows).onConflictDoNothing();
  }
}

/**
 * Ensure a build-chat agent has references to all builtin pool tools.
 * Called during org defaults setup.
 */
export async function ensureBuiltinToolRefs(
  db: DbLike,
  buildChatAgentId: string,
): Promise<void> {
  // First ensure pool tools exist
  await ensureBuiltinPoolTools(db);

  // Get all builtin pool tools
  const poolTools = await db
    .select({ id: tools.id })
    .from(tools)
    .where(and(isNull(tools.agentId), eq(tools.origin, "builtin")));

  // Create references
  for (const pt of poolTools) {
    await db
      .insert(agentResourceRefs)
      .values({
        agentId: buildChatAgentId,
        resourceType: "tool",
        resourceId: pt.id,
        enabled: true,
      })
      .onConflictDoNothing();
  }
}
