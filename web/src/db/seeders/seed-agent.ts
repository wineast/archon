import { join } from "path";
import { agents, agentMembers, users } from "../schema";
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
      isPlatform?: boolean;
    }>(join(ctx.agentDir, "agent.json"));

    // Check if agent already exists in this org
    const [existing] = await ctx.db
      .select()
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
          isPlatform: agentSeed.isPlatform ?? false,
        })
        .where(eq(agents.id, existing.id))
        .returning();
    } else {
      [agent] = await ctx.db
        .insert(agents)
        .values({
          name: agentSeed.name,
          slug: agentSeed.slug,
          description: agentSeed.description,
          icon: agentSeed.icon,
          isPlatform: agentSeed.isPlatform ?? false,
          orgId: ctx.orgId,
          isPublic: true,
        })
        .returning();
    }

    ctx.agentId = agent.id;
    log("ok", `${agent.name} (${agent.id})`);

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
