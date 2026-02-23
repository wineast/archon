import { agents, agentVersions, modelConfigs, embedTokens, orgMembers, orgs } from "../schema";
import { eq, and } from "drizzle-orm";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

/** Fixed dev-only values — deterministic so test.html can hardcode them. */
const DEV_HOST_AGENT_ID = "00000000-0000-0000-0000-000000000001";
const DEV_HOST_TOKEN = "et_dev_host_test_000000000000000000";
const SEED_USER_ID = "0814cf88-9fab-4369-a313-a3ea6f684daf";

export const seedDevHost: Seeder = {
  name: "dev-host",
  async run(ctx) {
    if (process.env.NODE_ENV === "production") {
      log("skip", "Skipping dev host agent (production)");
      return;
    }

    logSection("Seeding dev host agent");

    // Find the seed user's personal org
    const [membership] = await ctx.db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
      .where(and(eq(orgMembers.userId, SEED_USER_ID), eq(orgs.isPersonal, true)))
      .limit(1);

    if (!membership) {
      log("warn", "Seed user has no personal org — skipping dev host agent");
      return;
    }

    const orgId = membership.orgId;

    // Create host agent (idempotent)
    await ctx.db
      .insert(agents)
      .values({
        id: DEV_HOST_AGENT_ID,
        orgId,
        name: "Dev Host",
        slug: "dev-host",
        description: "Development-only host agent for embed testing",
        icon: "monitor",
      })
      .onConflictDoNothing();

    // Create initial version (if agent was just created or version missing)
    const existingVersions = await ctx.db
      .select({ id: agentVersions.id })
      .from(agentVersions)
      .where(eq(agentVersions.agentId, DEV_HOST_AGENT_ID))
      .limit(1);

    let versionId: string;

    if (existingVersions.length > 0) {
      versionId = existingVersions[0].id;
    } else {
      const [version] = await ctx.db
        .insert(agentVersions)
        .values({
          agentId: DEV_HOST_AGENT_ID,
          version: "0.1.0",
          changelog: "Initial version",
        })
        .returning();

      versionId = version.id;

      // Set editing/published version pointers
      await ctx.db
        .update(agents)
        .set({ editingVersionId: versionId, publishedVersionId: versionId })
        .where(eq(agents.id, DEV_HOST_AGENT_ID));

      // Create default model config (empty modelId — no model configured)
      await ctx.db.insert(modelConfigs).values({
        agentId: DEV_HOST_AGENT_ID,
        versionId,
        key: "default",
        name: "Default",
        modelId: "",
        isActive: true,
      });
    }

    // Create embed token (idempotent via unique token)
    await ctx.db
      .insert(embedTokens)
      .values({
        agentId: DEV_HOST_AGENT_ID,
        name: "Dev Test Token",
        token: DEV_HOST_TOKEN,
        allowedOrigins: [],
        isActive: true,
      })
      .onConflictDoNothing();

    log("ok", `Dev host agent ${DEV_HOST_AGENT_ID}`);
    log("ok", `Dev embed token ${DEV_HOST_TOKEN}`);
  },
};
