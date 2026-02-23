import { db as appDb } from "@/db";
import { agents, agentVersions, modelConfigs, judgeConfigs, orgSlots, embedTokens, tools } from "@/db/schema";
import { SLOT_KEYS } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { SLOT_DEFS } from "./constants";
import { ensureBuiltinToolRefs, ensureBuiltinWikiRefs } from "@/lib/pool/builtin-refs";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * Idempotently create the two host tools (update_content, edit_content) for the assist agent.
 * These tools are executed by the AssistDialog host via postMessage.
 */
async function ensureAssistHostTools(database: DbLike, agentId: string, versionId: string): Promise<void> {
  const base = { agentId, versionId, executionTarget: "host" as const, origin: "builtin" as const, enabled: true };

  await database
    .insert(tools)
    .values({
      ...base,
      key: "update_content",
      name: "update_content",
      description: "整体替换编辑器中的内容。适用于大范围重写。",
      parametersSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "完整的更新后内容" },
        },
        required: ["content"],
      },
    })
    .onConflictDoNothing();

  await database
    .insert(tools)
    .values({
      ...base,
      key: "edit_content",
      name: "edit_content",
      description: "局部编辑内容。在当前内容中找到 old_text 并替换为 new_text。",
      parametersSchema: {
        type: "object",
        properties: {
          old_text: { type: "string", description: "要匹配的原文片段，必须精确匹配" },
          new_text: { type: "string", description: "替换后的内容。为空字符串表示删除" },
        },
        required: ["old_text", "new_text"],
      },
    })
    .onConflictDoNothing();
}

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

      // Upgrade: backfill assist host tools for existing assist agents
      if (slotKey === "assist") {
        const [agentData] = await db
          .select({ editingVersionId: agents.editingVersionId })
          .from(agents)
          .where(eq(agents.id, agentId))
          .limit(1);
        if (agentData?.editingVersionId) {
          await ensureAssistHostTools(db, agentId, agentData.editingVersionId);
        }
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
        systemPrompt: def.defaultSystemPrompt,
        temperature: def.defaultTemperature,
        isActive: true,
      });

      // Seed builtin tool refs for builder slot
      if (slotKey === "builder") {
        await ensureBuiltinToolRefs(db, agentId, version.id);
      }

      // Seed builtin wiki refs and host tools for assist slot
      if (slotKey === "assist") {
        await ensureBuiltinWikiRefs(db, agentId, version.id);
        await ensureAssistHostTools(db, agentId, version.id);
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
