import { logSection, log } from "../seed-utils";
import { ensureBuiltinAgents } from "@/lib/builtin-agents/ensure";
import type { Seeder } from "./types";

export const seedBuiltinAgents: Seeder = {
  name: "builtin-agents",
  async run(ctx) {
    logSection("Seeding builtin agents");

    if (!ctx.orgId) {
      log("skip", "No orgId, skipping builtin agents");
      return;
    }

    await ensureBuiltinAgents(ctx.orgId, ctx.db);
    log("ok", "Builtin agents ensured (build-chat, assist)");
  },
};
