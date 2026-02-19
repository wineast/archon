import { orgs, orgMembers, users } from "../schema";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedOrgs: Seeder = {
  name: "orgs",
  async run(ctx) {
    logSection("Seeding orgs");

    // Fetch all users
    const allUsers = await ctx.db.select().from(users);

    if (allUsers.length === 0) {
      log("skip", "No users found, skipping org creation");
      return;
    }

    // Create personal org for the first user (used as seed org)
    const user = allUsers[0];
    const slug = user.id.slice(0, 8);
    const name = user.nickname || user.email.split("@")[0] || "个人空间";

    const [org] = await ctx.db
      .insert(orgs)
      .values({ name, slug, isPersonal: true })
      .onConflictDoUpdate({
        target: orgs.slug,
        set: { name },
      })
      .returning();

    ctx.orgId = org.id;
    log("ok", `Personal org: ${org.name} (${org.id})`);

    // Make all users owners of this org
    await Promise.all(
      allUsers.map((u) =>
        ctx.db
          .insert(orgMembers)
          .values({ orgId: org.id, userId: u.id, role: "owner" })
          .onConflictDoNothing()
      )
    );
    log("ok", `${allUsers.length} user(s) added as org owner`);
  },
};
