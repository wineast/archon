import { join } from "path";
import { users } from "../schema";
import { readJson, logSection, log } from "../seed-utils";
import { ensurePersonalOrg } from "@/lib/orgs/ensure-personal-org";
import type { Seeder } from "./types";

export const seedUsers: Seeder = {
  name: "users",
  async run(ctx) {
    logSection("Seeding users");

    const seedUserList = readJson<
      Array<{
        id: string;
        clerk_id: string;
        email: string;
        nickname: string | null;
        avatar_url: string | null;
        bio: string | null;
        platform_role: "user" | "super_admin";
      }>
    >(join(__dirname, "../seed-data/users.json"));

    const userRows = await Promise.all(
      seedUserList.map((u) =>
        ctx.db
          .insert(users)
          .values({
            id: u.id,
            clerkId: u.clerk_id,
            email: u.email,
            nickname: u.nickname,
            avatarUrl: u.avatar_url,
            bio: u.bio,
            platformRole: u.platform_role,
          })
          .onConflictDoUpdate({
            target: users.clerkId,
            set: { email: u.email, avatarUrl: u.avatar_url, platformRole: u.platform_role },
          })
          .returning(),
      ),
    );
    log("ok", `${seedUserList.length} users`);

    // Ensure each user has a personal org (with slot agents)
    for (const [user] of userRows) {
      const orgId = await ensurePersonalOrg(user, ctx.db);
      log("ok", `Personal org for ${user.email}: ${orgId}`);
    }
  },
};
