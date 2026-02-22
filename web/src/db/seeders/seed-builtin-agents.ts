import { logSection, log } from "../seed-utils";
import { ensureOrgDefaults } from "@/lib/slots";
import type { Seeder } from "./types";

export const seedBuiltinAgents: Seeder = {
  name: "builtin-agents",
  async run(ctx) {
    logSection("Seeding builtin agents");

    if (!ctx.orgId) {
      log("skip", "No orgId, skipping builtin agents");
      return;
    }

    await ensureOrgDefaults(ctx.orgId, ctx.db);
    log("ok", "Org defaults ensured (builder, assist, evaluator)");
  },
};
