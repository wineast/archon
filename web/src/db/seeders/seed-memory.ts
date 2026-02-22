import { join } from "path";
import { memoryConfigs, memories } from "../schema";
import type { MemoryTypeDef } from "../schema";
import { eq, and, isNull } from "drizzle-orm";
import { logSection, log, readJson } from "../seed-utils";
import type { Seeder } from "./types";

interface MemorySeed {
  typeDefs: MemoryTypeDef[];
  samples: Array<{
    type: string;
    content: string;
    userId: string | null;
    importance: number;
  }>;
}

export const seedMemory: Seeder = {
  name: "memory",
  async run(ctx) {
    logSection("Seeding memory config + memories");

    const seed = readJson<MemorySeed>(join(ctx.agentDir, "memory.json"));

    // Upsert memory config
    const [config] = await ctx.db
      .insert(memoryConfigs)
      .values({
        agentId: ctx.agentId,
        versionId: ctx.versionId,
        autoExtract: false,
        extractionPrompt: "",
        injectionMode: "system_prompt",
        maxInjectedMemories: 10,
        maxMemoriesPerUser: 100,
        maxGlobalMemories: 1000,
        decayEnabled: false,
        decayDays: 90,
        memoryTypeDefs: seed.typeDefs,
      })
      .onConflictDoUpdate({
        target: memoryConfigs.versionId,
        set: {
          memoryTypeDefs: seed.typeDefs,
        },
      })
      .returning();

    log("ok", `memory config (${config.id})`);

    if (seed.samples.length === 0) return;

    // Check existing memories to avoid duplicates
    const existing = await ctx.db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.agentId, ctx.agentId), isNull(memories.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      log("skip", "memories already exist");
      return;
    }

    // Seed sample memories
    const rows = await ctx.db
      .insert(memories)
      .values(
        seed.samples.map((m) => ({
          agentId: ctx.agentId,
          type: m.type,
          content: m.content,
          userId: m.userId,
          importance: m.importance,
        }))
      )
      .returning({ id: memories.id });

    log("ok", `${rows.length} memories seeded`);
  },
};
