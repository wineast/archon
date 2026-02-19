import { eq } from "drizzle-orm";
import { agents, agentVersions, users } from "../schema";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedVersion: Seeder = {
  name: "version",
  async run(ctx) {
    logSection("Creating initial version 0.1.0");

    const allUsers = await ctx.db.select({ id: users.id }).from(users);

    const { buildSnapshot } = await import("@/lib/versions/snapshot");
    // buildSnapshot expects `typeof db` which includes `$client`, but our SeedDb
    // is functionally equivalent for query purposes
    const snapshot = await buildSnapshot(ctx.agentId, ctx.db as never);

    const [initialVersion] = await ctx.db
      .insert(agentVersions)
      .values({
        agentId: ctx.agentId,
        version: "0.1.0",
        changelog: "Initial version",
        snapshot,
        createdBy: allUsers[0]?.id ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (initialVersion) {
      await ctx.db
        .update(agents)
        .set({
          editingVersionId: initialVersion.id,
          publishedVersionId: initialVersion.id,
        })
        .where(eq(agents.id, ctx.agentId));
      log("ok", `v0.1.0 (${initialVersion.id}) [editing + published]`);
    } else {
      log("skip", "v0.1.0 already exists");
    }
  },
};
