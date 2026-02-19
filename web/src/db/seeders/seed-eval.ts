import { join } from "path";
import { nanoid } from "nanoid";
import { evalCases, evalJudgeConfigs, evalRunResults, evalRuns } from "../schema";
import { readJson, toKey, logSection, log } from "../seed-utils";
import type { Assertion, Dimension } from "@/lib/eval/types";
import type { Seeder } from "./types";

export const seedEval: Seeder = {
  name: "eval",
  async run(ctx) {
    const { agentId } = ctx;

    // ── Judge configs ──
    logSection("Seeding eval judge configs");

    const judgeConfigSeed = readJson<{
      key?: string;
      name: string;
      model: string;
      systemPrompt: string;
      temperature: number;
      dimensions?: Dimension[];
      isDefault: boolean;
    }>(join(ctx.agentDir, "eval-judge-config.json"));

    const judgeKey = judgeConfigSeed.key ?? toKey(judgeConfigSeed.name);
    const [judgeConfig] = await ctx.db
      .insert(evalJudgeConfigs)
      .values({ ...judgeConfigSeed, key: judgeKey, dimensions: judgeConfigSeed.dimensions ?? [], agentId })
      .onConflictDoUpdate({
        target: [evalJudgeConfigs.agentId, evalJudgeConfigs.key],
        set: {
          name: judgeConfigSeed.name,
          model: judgeConfigSeed.model,
          systemPrompt: judgeConfigSeed.systemPrompt,
          temperature: judgeConfigSeed.temperature,
          dimensions: judgeConfigSeed.dimensions ?? [],
          isDefault: judgeConfigSeed.isDefault,
        },
      })
      .returning();
    ctx.ids.evalJudgeConfigId = judgeConfig.id;
    log("ok", `${judgeConfig.key} (${judgeConfig.id})`);

    // ── Clear eval runs ──
    logSection("Clearing eval runs");
    await ctx.db.delete(evalRunResults);
    await ctx.db.delete(evalRuns);
    log("ok", "eval runs cleared");

    // ── Eval cases ──
    logSection("Seeding eval cases");

    const evalCasesSeed = readJson<
      Array<{
        key?: string;
        name: string;
        input: string;
        expectedOutput: string;
        assertions: Array<Omit<Assertion, "id">>;
        tags: string[];
      }>
    >(join(ctx.agentDir, "eval-cases.json"));

    for (const c of evalCasesSeed) {
      const key = c.key ?? toKey(c.name);
      const [row] = await ctx.db
        .insert(evalCases)
        .values({
          key,
          name: c.name,
          input: c.input,
          expectedOutput: c.expectedOutput || null,
          assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
          tags: c.tags,
          agentId,
        })
        .onConflictDoUpdate({
          target: [evalCases.agentId, evalCases.key],
          set: {
            name: c.name,
            input: c.input,
            expectedOutput: c.expectedOutput || null,
            assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
            tags: c.tags,
          },
        })
        .returning();
      ctx.ids.evalCaseIds.push(row.id);
    }
    log("ok", `${evalCasesSeed.length} eval cases`);
  },
};
