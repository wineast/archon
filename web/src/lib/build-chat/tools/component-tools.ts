import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { components } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildComponentTools(agentId: string): Record<string, AnyTool> {
  return {
    list_components: tool({
      description: "列出当前 Agent 的所有组件",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: components.id,
            key: components.key,
            name: components.name,
            description: components.description,
            toolInputSchemaId: components.toolInputSchemaId,
            toolOutputSchemaId: components.toolOutputSchemaId,
          })
          .from(components)
          .where(eq(components.agentId, agentId));
        return { components: rows, _mutateKeys: [`/api/components?agentId=${agentId}`] };
      },
    }),

    get_component: tool({
      description: "获取组件详情，包含 componentSource 大字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(components)
          .where(and(eq(components.id, id), eq(components.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "组件不存在" };
        return { component: row, _mutateKeys: [] };
      },
    }),

    create_component: tool({
      description: "创建新组件",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().optional().default(""),
        componentSource: z.string().optional().default("").describe("JSX 源码"),
        toolInputSchemaId: z.string().uuid().optional().describe("关联的 Input Schema ID"),
        toolOutputSchemaId: z.string().uuid().optional().describe("关联的 Output Schema ID"),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(components)
          .values({ ...params, agentId })
          .returning();
        return {
          component: row,
          _mutateKeys: [`/api/components?agentId=${agentId}`],
        };
      },
    }),

    update_component: tool({
      description: "更新组件",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        componentSource: z.string().optional(),
        toolInputSchemaId: z.string().uuid().nullable().optional().describe("关联的 Input Schema ID"),
        toolOutputSchemaId: z.string().uuid().nullable().optional().describe("关联的 Output Schema ID"),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(components)
          .set(updates)
          .where(and(eq(components.id, id), eq(components.agentId, agentId)))
          .returning();
        if (!row) return { error: "组件不存在" };
        return {
          component: row,
          _mutateKeys: [`/api/components?agentId=${agentId}`],
        };
      },
    }),

    delete_component: tool({
      description: "删除组件",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(components)
          .where(and(eq(components.id, id), eq(components.agentId, agentId)))
          .returning({ id: components.id });
        if (!row) return { error: "组件不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/components?agentId=${agentId}`],
        };
      },
    }),
  };
}
