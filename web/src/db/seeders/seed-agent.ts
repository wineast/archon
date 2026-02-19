import { join } from "path";
import { agents } from "../schema";
import { readJson, logSection, log } from "../seed-utils";
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
    }>(join(ctx.agentDir, "agent.json"));

    const [agent] = await ctx.db
      .insert(agents)
      .values(agentSeed)
      .onConflictDoUpdate({
        target: agents.slug,
        set: {
          name: agentSeed.name,
          description: agentSeed.description,
          icon: agentSeed.icon,
        },
      })
      .returning();

    ctx.agentId = agent.id;
    log("ok", `${agent.name} (${agent.id})`);
  },
};
