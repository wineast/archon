import { db as appDb } from "@/db";
import { agents, agentVersions, modelConfigs, judgeConfigs, embedTokens } from "@/db/schema";
import { SLOT_KEYS } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { SLOT_DEFS } from "./constants";
import { ensureBuiltinToolRefs, ensureBuiltinComponentRefs, ensureBuiltinWikiRefs } from "@/lib/pool/builtin-refs";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * Idempotently ensure all default slot agents exist for the given org.
 * Creates builder, assist, evaluator and support agents with default model configs.
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

      // Upgrade: backfill empty system prompt for assist slot
      if (slotKey === "assist" && def.defaultSystemPrompt) {
        await db
          .update(modelConfigs)
          .set({ systemPrompt: def.defaultSystemPrompt })
          .where(
            and(
              eq(modelConfigs.agentId, agentId),
              eq(modelConfigs.isActive, true),
              eq(modelConfigs.systemPrompt, ""),
            ),
          );
      }
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
        })
        .returning();

      agentId = agent.id;

      // Create initial version
      const [version] = await db
        .insert(agentVersions)
        .values({
          agentId,
          version: "0.0.0",
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
        systemPrompt: def.defaultSystemPrompt,
        temperature: def.defaultTemperature,
        isActive: true,
      });

      // Seed builtin component refs for all slot agents
      await ensureBuiltinComponentRefs(db, agentId, version.id);

      // Seed builtin tool refs for builder slot
      if (slotKey === "builder") {
        await ensureBuiltinToolRefs(db, agentId, version.id);
      }

      // Seed builtin wiki refs for assist slot
      if (slotKey === "assist") {
        await ensureBuiltinWikiRefs(db, agentId, version.id);
      }

      // Seed default judge config for evaluator slot
      if (slotKey === "evaluator") {
        await db.insert(judgeConfigs).values({
          agentId,
          versionId: version.id,
          key: "default",
          name: "Default",
          isActive: true,
          dimensions: [
            { key: "accuracy", label: "Accuracy", weight: 0.5 },
            { key: "completeness", label: "Completeness", weight: 0.3 },
            { key: "tone", label: "Tone", weight: 0.2 },
          ],
        });
      }

      // Seed default embed token for support slot
      if (slotKey === "support") {
        await db.insert(embedTokens).values({
          agentId,
          name: "Support Widget",
          token: `et_${nanoid(32)}`,
          allowedOrigins: [],
          isActive: true,
        });
      }
    }
  }
}
