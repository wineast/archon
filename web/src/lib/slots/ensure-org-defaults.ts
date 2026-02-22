import { db as appDb } from "@/db";
import { agents, agentVersions, modelConfigs, orgSlots } from "@/db/schema";
import { SLOT_KEYS } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SLOT_DEFS } from "./constants";
import { ensureBuiltinToolRefs } from "@/lib/pool/seed-builtin-tools";
import { ensureBuiltinPoolFunctions } from "@/lib/pool/seed-builtin-functions";

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

  // Seed builtin pool functions (once per call, idempotent)
  await ensureBuiltinPoolFunctions(db);

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

      // Create initial version
      const [version] = await db
        .insert(agentVersions)
        .values({
          agentId,
          version: "0.1.0",
          changelog: "Initial version",
        })
        .returning();

      // Set editing/published version pointers
      await db
        .update(agents)
        .set({ editingVersionId: version.id, publishedVersionId: version.id })
        .where(eq(agents.id, agentId));

      // Create default active model config
      await db.insert(modelConfigs).values({
        agentId,
        versionId: version.id,
        key: "default",
        name: "Default",
        modelId: def.defaultModel,
        temperature: def.defaultTemperature,
        isActive: true,
      });

      // Seed builtin tool refs for builder slot
      if (slotKey === "builder") {
        await ensureBuiltinToolRefs(db, agentId, version.id);
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

