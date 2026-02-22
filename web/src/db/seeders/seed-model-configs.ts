import { join } from "path";
import { modelConfigs } from "../schema";
import { readJson, toKey, logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedModelConfigs: Seeder = {
  name: "model-configs",
  async run(ctx) {
    logSection("Seeding model configs");

    const modelConfigSeed = readJson<
      Array<{
        key?: string;
        name: string;
        modelId?: string;
        systemPrompt: string;
        temperature: number;
        isActive: boolean;
      }>
    >(join(ctx.agentDir, "model-configs.json"));

    for (const cfg of modelConfigSeed) {
      const key = cfg.key ?? toKey(cfg.name);
      const [row] = await ctx.db
        .insert(modelConfigs)
        .values({ ...cfg, key, agentId: ctx.agentId, versionId: ctx.versionId })
        .onConflictDoUpdate({
          target: [modelConfigs.versionId, modelConfigs.key],
          set: {
            name: cfg.name,
            modelId: cfg.modelId ?? "",
            systemPrompt: cfg.systemPrompt,
            temperature: cfg.temperature,
            isActive: cfg.isActive,
          },
        })
        .returning();
      ctx.ids.modelConfigIds.push(row.id);
      log("info", `${row.key} (${row.id})${row.isActive ? " [active]" : ""}`);
    }
  },
};
