import { db as appDb } from "@/db";
import { agents, modelConfigs, tools } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { BUILTIN_AGENT_DEFS, RESERVED_SLUGS } from "./constants";
import { buildAllTools } from "@/lib/build-chat/tools";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * Idempotently ensure all builtin agents exist for the given org.
 * Creates build-chat and assist agents with default model configs.
 * Also seeds system tools for build-chat.
 *
 * @param orgId - The org to create agents for
 * @param database - Optional DB instance (used by seeders that have their own connection)
 */
export async function ensureBuiltinAgents(orgId: string, database?: DbLike): Promise<void> {
  const db = database ?? appDb;

  for (const slug of RESERVED_SLUGS) {
    const def = BUILTIN_AGENT_DEFS[slug];

    // Check if already exists
    const [existing] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.orgId, orgId), eq(agents.slug, slug)))
      .limit(1);

    if (existing) continue;

    // Create agent
    const [agent] = await db
      .insert(agents)
      .values({
        orgId,
        name: def.name,
        slug: def.slug,
        description: def.description,
        icon: def.icon,
        scope: def.scope,
      })
      .returning();

    // Create default active model config
    await db.insert(modelConfigs).values({
      agentId: agent.id,
      key: "default",
      name: "Default",
      modelId: def.defaultModel,
      temperature: def.defaultTemperature,
      isActive: true,
    });

    // Seed system tools for build-chat
    if (slug === "build-chat") {
      await seedSystemTools(db, agent.id);
    }
  }
}

/**
 * Seed system tools for a build-chat agent by introspecting buildAllTools.
 */
async function seedSystemTools(db: DbLike, buildChatAgentId: string): Promise<void> {
  // Use a dummy agentId — we only need the tool metadata (key + description)
  const allTools = buildAllTools("00000000-0000-0000-0000-000000000000");

  const rows = Object.entries(allTools).map(([key, t]) => ({
    agentId: buildChatAgentId,
    key,
    name: key,
    description: (t as { description?: string }).description ?? "",
    isSystem: true,
    enabled: true,
    handler: null,
    executionTarget: "server" as const,
  }));

  if (rows.length > 0) {
    await db.insert(tools).values(rows).onConflictDoNothing();
  }
}
