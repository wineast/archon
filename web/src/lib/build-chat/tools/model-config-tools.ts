import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

const mutateKeys = (agentId: string) => [
  `/api/model-configs?agentId=${agentId}`,
  `/api/model-configs/active?agentId=${agentId}`,
];

export function buildModelConfigTools(agentId: string): Record<string, AnyTool> {
  return {
    list_model_configs: tool({
      description: "列出当前 Agent 的所有模型配置",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: modelConfigs.id,
            key: modelConfigs.key,
            name: modelConfigs.name,
            modelId: modelConfigs.modelId,
            temperature: modelConfigs.temperature,
            isActive: modelConfigs.isActive,
          })
          .from(modelConfigs)
          .where(eq(modelConfigs.agentId, agentId));
        return { modelConfigs: rows, _mutateKeys: mutateKeys(agentId) };
      },
    }),

    get_model_config: tool({
      description: "获取模型配置详情，包含 systemPrompt 大字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(modelConfigs)
          .where(and(eq(modelConfigs.id, id), eq(modelConfigs.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "模型配置不存在" };
        return { modelConfig: row, _mutateKeys: [] };
      },
    }),

    create_model_config: tool({
      description: "创建新模型配置",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        modelId: z.string().describe("模型 ID，如 anthropic/claude-sonnet-4"),
        systemPrompt: z.string().optional().default(""),
        temperature: z.number().optional().default(0.7),
        isActive: z.boolean().optional().default(false),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(modelConfigs)
          .values({ ...params, agentId })
          .returning();
        return { modelConfig: row, _mutateKeys: mutateKeys(agentId) };
      },
    }),

    update_model_config: tool({
      description: "更新模型配置",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        modelId: z.string().optional(),
        systemPrompt: z.string().optional(),
        temperature: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(modelConfigs)
          .set(updates)
          .where(and(eq(modelConfigs.id, id), eq(modelConfigs.agentId, agentId)))
          .returning();
        if (!row) return { error: "模型配置不存在" };
        return { modelConfig: row, _mutateKeys: mutateKeys(agentId) };
      },
    }),

    delete_model_config: tool({
      description: "删除模型配置",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(modelConfigs)
          .where(and(eq(modelConfigs.id, id), eq(modelConfigs.agentId, agentId)))
          .returning({ id: modelConfigs.id });
        if (!row) return { error: "模型配置不存在" };
        return { deleted: true, _mutateKeys: mutateKeys(agentId) };
      },
    }),
  };
}
