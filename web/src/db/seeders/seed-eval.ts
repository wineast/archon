import { join } from "path";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { evalCases, judgeConfigs, evalRunResults, evalRuns } from "../schema";
import { readJson, toKey, logSection, log } from "../seed-utils";
import type { Assertion, Dimension, EvalCaseMode, EvalTurn } from "@/lib/eval/types";
import type { Seeder } from "./types";

export const seedEval: Seeder = {
  name: "eval",
  async run(ctx) {
    const { agentId } = ctx;

    // ── Judge configs ──
    logSection("Seeding judge configs");

    const judgeConfigSeed = readJson<{
      key?: string;
      name: string;
      dimensions?: Dimension[];
      isActive: boolean;
    }>(join(ctx.agentDir, "judge-config.json"));

    const judgeKey = judgeConfigSeed.key ?? toKey(judgeConfigSeed.name);
    const [judgeConfig] = await ctx.db
      .insert(judgeConfigs)
      .values({ key: judgeKey, name: judgeConfigSeed.name, dimensions: judgeConfigSeed.dimensions ?? [], isActive: judgeConfigSeed.isActive, agentId, versionId: ctx.versionId })
      .onConflictDoUpdate({
        target: [judgeConfigs.versionId, judgeConfigs.key],
        targetWhere: sql`deleted_at IS NULL`,
        set: {
          name: judgeConfigSeed.name,
          dimensions: judgeConfigSeed.dimensions ?? [],
          isActive: judgeConfigSeed.isActive,
        },
      })
      .returning();
    ctx.ids.judgeConfigId = judgeConfig.id;
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
        mode: EvalCaseMode;
        turns: Array<Omit<EvalTurn, "id"> & { assertions?: Array<Omit<Assertion, "id">>; judge?: boolean }>;
        expectedOutput: string;
        assertions: Array<Omit<Assertion, "id">>;
        tags: string[];
      }>
    >(join(ctx.agentDir, "eval-cases.json"));

    for (const c of evalCasesSeed) {
      const key = c.key ?? toKey(c.name);
      const turns: EvalTurn[] = c.turns.map((t) => ({
        id: nanoid(),
        role: t.role,
        content: t.content,
        ...(t.assertions ? { assertions: t.assertions.map((a): Assertion => ({ ...a, id: nanoid() })) } : {}),
        ...(t.judge !== undefined ? { judge: t.judge } : {}),
      }));
      const [row] = await ctx.db
        .insert(evalCases)
        .values({
          key,
          name: c.name,
          mode: c.mode,
          turns,
          expectedOutput: c.expectedOutput || null,
          assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
          tags: c.tags,
          agentId,
          versionId: ctx.versionId,
        })
        .onConflictDoUpdate({
          target: [evalCases.versionId, evalCases.key],
          targetWhere: sql`deleted_at IS NULL`,
          set: {
            name: c.name,
            mode: c.mode,
            turns,
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
