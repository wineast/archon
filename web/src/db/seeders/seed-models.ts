import { join } from "path";
import { models } from "../schema";
import { readJson, logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedModels: Seeder = {
  name: "models",
  async run(ctx) {
    logSection("Seeding global models");

    const modelsSeed = readJson<
      Array<{ modelId: string; name: string; provider: string }>
    >(join(__dirname, "../seed-data/models.json"));

    await Promise.all(
      modelsSeed.map((m) =>
        ctx.db
          .insert(models)
          .values(m)
          .onConflictDoUpdate({
            target: models.modelId,
            set: { name: m.name, provider: m.provider },
          }),
      ),
    );
    log("ok", `${modelsSeed.length} models`);
  },
};
