import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { embedTokens } from "../schema";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedEmbedToken: Seeder = {
  name: "embed-token",
  async run(ctx) {
    logSection("Seeding embed token");

    // Check if a token already exists for this agent
    const [existing] = await ctx.db
      .select()
      .from(embedTokens)
      .where(eq(embedTokens.agentId, ctx.agentId))
      .limit(1);

    if (existing) {
      log("skip", `embed token already exists (${existing.id})`);
      return;
    }

    const token = `et_${nanoid(32)}`;
    const [row] = await ctx.db
      .insert(embedTokens)
      .values({
        agentId: ctx.agentId,
        name: "Default",
        token,
        allowedOrigins: [],
      })
      .returning();

    log("ok", `embed token created (${row.id})`);
  },
};
