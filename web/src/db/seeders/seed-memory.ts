import { memoryConfigs, memories } from "../schema";
import type { MemoryTypeDef } from "../schema";
import { eq, and, isNull } from "drizzle-orm";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

const SEED_TYPE_DEFS: MemoryTypeDef[] = [
  { key: "preference", description: "用户偏好和习惯，如回复风格、语言偏好等" },
  { key: "fact", description: "关于用户或业务的客观事实信息" },
  { key: "event", description: "发生过的重要事件和时间节点" },
  { key: "skill", description: "用户具备的技能和能力" },
  { key: "requirement", description: "用户提出的功能需求或业务要求" },
  { key: "feedback", description: "用户对产品或服务的反馈意见" },
];

export const seedMemory: Seeder = {
  name: "memory",
  async run(ctx) {
    logSection("Seeding memory config + memories");

    // Upsert memory config
    const [config] = await ctx.db
      .insert(memoryConfigs)
      .values({
        agentId: ctx.agentId,
        enabled: true,
        autoExtract: false,
        extractionPrompt: "",
        injectionMode: "system_prompt",
        maxInjectedMemories: 10,
        maxMemoriesPerUser: 100,
        maxGlobalMemories: 1000,
        decayEnabled: false,
        decayDays: 90,
        memoryTypeDefs: SEED_TYPE_DEFS,
      })
      .onConflictDoUpdate({
        target: memoryConfigs.agentId,
        set: {
          enabled: true,
          memoryTypeDefs: SEED_TYPE_DEFS,
        },
      })
      .returning();

    log("ok", `memory config (${config.id})`);

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
    const sampleMemories = [
      {
        type: "preference",
        content: "用户偏好简洁的回复风格，不需要过多解释",
        userId: "user_001",
        importance: 0.8,
      },
      {
        type: "fact",
        content: "用户是一名前端开发工程师，主要使用 React 和 TypeScript",
        userId: "user_001",
        importance: 0.9,
      },
      {
        type: "event",
        content: "用户在 2025-12 完成了从 Vue 到 React 的项目迁移",
        userId: "user_001",
        importance: 0.6,
      },
      {
        type: "skill",
        content: "用户熟悉 Tailwind CSS、Next.js 和 Vercel 部署流程",
        userId: "user_001",
        importance: 0.7,
      },
      {
        type: "fact",
        content: "公司使用 PostgreSQL 作为主数据库，Redis 做缓存",
        userId: null,
        importance: 0.85,
      },
      {
        type: "requirement",
        content: "所有 API 响应需要在 200ms 内返回",
        userId: null,
        importance: 0.9,
      },
      {
        type: "feedback",
        content: "用户反馈搜索功能的结果排序不够准确，需要改进",
        userId: "user_002",
        importance: 0.7,
      },
      {
        type: "preference",
        content: "用户偏好深色主题，希望界面支持 dark mode",
        userId: "user_002",
        importance: 0.5,
      },
    ];

    const rows = await ctx.db
      .insert(memories)
      .values(
        sampleMemories.map((m) => ({
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
