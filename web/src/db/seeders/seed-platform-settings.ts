import { platformSettings } from "../schema";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedPlatformSettings: Seeder = {
  name: "platform-settings",
  async run(ctx) {
    logSection("Seeding platform settings");

    await ctx.db
      .insert(platformSettings)
      .values({ id: "singleton" })
      .onConflictDoNothing();

    log("ok", "platform settings singleton ensured");
  },
};
