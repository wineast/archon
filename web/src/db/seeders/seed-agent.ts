import { join } from "path";
import { agents, agentMembers, agentVersions, users } from "../schema";
import type { AgentScope } from "../schema";
import { readJson, logSection, log } from "../seed-utils";
import { eq, and } from "drizzle-orm";
import type { Seeder } from "./types";

export const seedAgent: Seeder = {
  name: "agent",
  async run(ctx) {
    logSection("Seeding agent");

    const agentSeed = readJson<{
      name: string;
      slug: string;
      description: string;
      icon: string;
      scope?: AgentScope;
      /** @deprecated use scope instead */
      isPlatform?: boolean;
    }>(join(ctx.agentDir, "agent.json"));

    // Resolve scope: prefer explicit scope, fallback from legacy isPlatform
    const scope: AgentScope = agentSeed.scope ?? (agentSeed.isPlatform ? "platform" : "org");

    // Check if agent already exists in this org
    const [existing] = await ctx.db
      .select({ id: agents.id, editingVersionId: agents.editingVersionId })
      .from(agents)
      .where(
        and(eq(agents.orgId, ctx.orgId), eq(agents.slug, agentSeed.slug))
      )
      .limit(1);

    let agent;
    if (existing) {
      [agent] = await ctx.db
        .update(agents)
        .set({
          name: agentSeed.name,
          description: agentSeed.description,
          icon: agentSeed.icon,
          scope,
        })
        .where(eq(agents.id, existing.id))
        .returning();

      // Use existing editing version
      ctx.versionId = existing.editingVersionId ?? "";
    } else {
      [agent] = await ctx.db
        .insert(agents)
        .values({
          name: agentSeed.name,
          slug: agentSeed.slug,
          description: agentSeed.description,
          icon: agentSeed.icon,
          scope,
          orgId: ctx.orgId,
          isPublic: true,
        })
        .returning();

      // Create initial version
      const [version] = await ctx.db
        .insert(agentVersions)
        .values({
          agentId: agent.id,
          version: "0.1.0",
          changelog: "Initial version",
        })
        .returning();

      // Set pointers
      await ctx.db
        .update(agents)
        .set({ editingVersionId: version.id, publishedVersionId: version.id })
        .where(eq(agents.id, agent.id));

      ctx.versionId = version.id;
    }

    ctx.agentId = agent.id;
    log("ok", `${agent.name} (${agent.id}) version=${ctx.versionId}`);

    // Make all users owners of the agent
    logSection("Seeding agent members");
    const allUsers = await ctx.db.select({ id: users.id }).from(users);
    await Promise.all(
      allUsers.map((u) =>
        ctx.db
          .insert(agentMembers)
          .values({ agentId: agent.id, userId: u.id, role: "owner" })
          .onConflictDoNothing(),
      ),
    );
    log("ok", `${allUsers.length} user(s) added as agent owner`);
  },
};
