import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { memoryConfigs, memories } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

const configMutateKeys = (agentId: string) => [
  `/api/memory-configs?agentId=${agentId}`,
];

const memoriesMutateKeys = (agentId: string) => [
  `/api/memories?agentId=${agentId}`,
];

export function buildMemoryTools(agentId: string): Record<string, AnyTool> {
  return {
    get_memory_config: tool({
      description: "获取当前 Agent 的记忆配置",
      inputSchema: z.object({}),
      execute: async () => {
        const [row] = await db
          .select()
          .from(memoryConfigs)
          .where(eq(memoryConfigs.agentId, agentId))
          .limit(1);
        return {
          memoryConfig: row ?? null,
          _mutateKeys: configMutateKeys(agentId),
        };
      },
    }),

    update_memory_config: tool({
      description: "更新记忆配置（不存在则自动创建）",
      inputSchema: z.object({
        autoExtract: z.boolean().optional(),
        extractionPrompt: z.string().optional(),
        maxMemoriesPerUser: z.number().int().optional(),
        maxGlobalMemories: z.number().int().optional(),
        injectionMode: z.enum(["system_prompt", "context", "none"]).optional(),
        maxInjectedMemories: z.number().int().optional(),
        decayEnabled: z.boolean().optional(),
        decayDays: z.number().int().optional(),
        memoryTypeDefs: z.array(z.object({
          key: z.string().describe("类型标识，snake_case"),
          label: z.string().describe("显示名称"),
          description: z.string().describe("语义描述，告诉 AI 这个类型代表什么"),
        })).optional().describe("记忆类型定义列表"),
      }),
      execute: async (params) => {
        const [existing] = await db
          .select({ id: memoryConfigs.id })
          .from(memoryConfigs)
          .where(eq(memoryConfigs.agentId, agentId))
          .limit(1);

        let row;
        if (existing) {
          [row] = await db
            .update(memoryConfigs)
            .set(params)
            .where(eq(memoryConfigs.id, existing.id))
            .returning();
        } else {
          [row] = await db
            .insert(memoryConfigs)
            .values({ ...params, agentId })
            .returning();
        }

        return {
          memoryConfig: row,
          _mutateKeys: configMutateKeys(agentId),
        };
      },
    }),

    list_memories: tool({
      description: "列出当前 Agent 的所有记忆条目",
      inputSchema: z.object({
        userId: z.string().optional().describe("按用户 ID 筛选"),
      }),
      execute: async ({ userId }) => {
        const conditions = [
          eq(memories.agentId, agentId),
          isNull(memories.deletedAt),
        ];
        if (userId) {
          conditions.push(eq(memories.userId, userId));
        }
        const rows = await db
          .select({
            id: memories.id,
            type: memories.type,
            content: memories.content,
            userId: memories.userId,
            importance: memories.importance,
            createdAt: memories.createdAt,
          })
          .from(memories)
          .where(and(...conditions))
          .orderBy(memories.createdAt);
        return { memories: rows, _mutateKeys: memoriesMutateKeys(agentId) };
      },
    }),

    get_memory: tool({
      description: "获取单条记忆详情",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(memories)
          .where(
            and(
              eq(memories.id, id),
              eq(memories.agentId, agentId),
              isNull(memories.deletedAt)
            )
          )
          .limit(1);
        if (!row) return { error: "记忆不存在" };
        return { memory: row, _mutateKeys: [] };
      },
    }),

    create_memory: tool({
      description: "创建新记忆条目",
      inputSchema: z.object({
        type: z.string().describe("记忆类型，预设: preference/fact/event/skill/custom，也可使用自定义类型"),
        content: z.string().describe("记忆内容"),
        userId: z.string().optional().describe("关联用户 ID，为空则为全局记忆"),
        importance: z.number().min(0).max(1).optional().default(0.5),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(memories)
          .values({
            agentId,
            type: params.type,
            content: params.content,
            userId: params.userId ?? null,
            importance: params.importance,
          })
          .returning();
        return { memory: row, _mutateKeys: memoriesMutateKeys(agentId) };
      },
    }),

    update_memory: tool({
      description: "更新记忆条目",
      inputSchema: z.object({
        id: z.string().uuid(),
        type: z.string().optional(),
        content: z.string().optional(),
        importance: z.number().min(0).max(1).optional(),
        userId: z.string().nullable().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(memories)
          .set(updates)
          .where(
            and(
              eq(memories.id, id),
              eq(memories.agentId, agentId),
              isNull(memories.deletedAt)
            )
          )
          .returning();
        if (!row) return { error: "记忆不存在" };
        return { memory: row, _mutateKeys: memoriesMutateKeys(agentId) };
      },
    }),

    delete_memory: tool({
      description: "删除记忆条目（软删除）",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .update(memories)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(memories.id, id),
              eq(memories.agentId, agentId),
              isNull(memories.deletedAt)
            )
          )
          .returning({ id: memories.id });
        if (!row) return { error: "记忆不存在" };
        return { deleted: true, _mutateKeys: memoriesMutateKeys(agentId) };
      },
    }),
  };
}
