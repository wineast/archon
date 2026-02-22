import { db as appDb } from "@/db";
import { agents, modelConfigs, orgSlots, tools } from "@/db/schema";
import { SLOT_KEYS } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SLOT_DEFS } from "./constants";
import { buildAllTools } from "@/lib/build-chat/tools";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * Idempotently ensure all default slot agents and orgSlot records exist for the given org.
 * Creates builder, assist, and evaluator agents with default model configs,
 * and links them in the orgSlots table.
 * Builder slot also seeds system tools.
 *
 * @param orgId - The org to create defaults for
 * @param database - Optional DB instance (used by seeders that have their own connection)
 */
export async function ensureOrgDefaults(orgId: string, database?: DbLike): Promise<void> {
  const db = database ?? appDb;

  for (const slotKey of SLOT_KEYS) {
    const def = SLOT_DEFS[slotKey];

    // Check if agent already exists
    const [existing] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.orgId, orgId), eq(agents.slug, def.defaultAgentSlug)))
      .limit(1);

    let agentId: string;

    if (existing) {
      agentId = existing.id;
    } else {
      // Create agent
      const [agent] = await db
        .insert(agents)
        .values({
          orgId,
          name: def.defaultAgentName,
          slug: def.defaultAgentSlug,
          description: def.description,
          icon: def.defaultAgentIcon,
          scope: "org",
        })
        .returning();

      agentId = agent.id;

      // Create default active model config
      await db.insert(modelConfigs).values({
        agentId,
        key: "default",
        name: "Default",
        modelId: def.defaultModel,
        temperature: def.defaultTemperature,
        isActive: true,
      });

      // Seed system tools for builder slot
      if (slotKey === "builder") {
        await seedSystemTools(db, agentId);
      }
    }

    // Ensure orgSlot record exists
    await db
      .insert(orgSlots)
      .values({
        orgId,
        slotKey,
        agentId,
      })
      .onConflictDoNothing();
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
