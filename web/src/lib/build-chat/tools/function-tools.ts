import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { functions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildFunctionTools(agentId: string): Record<string, AnyTool> {
  return {
    list_functions: tool({
      description: "列出当前 Agent 的所有函数",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: functions.id,
            key: functions.key,
            name: functions.name,
            description: functions.description,
          })
          .from(functions)
          .where(eq(functions.agentId, agentId));
        return { functions: rows, _mutateKeys: [`/api/functions?agentId=${agentId}`] };
      },
    }),

    get_function: tool({
      description: "获取函数详情，包含 code 大字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(functions)
          .where(and(eq(functions.id, id), eq(functions.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "函数不存在" };
        return { function: row, _mutateKeys: [] };
      },
    }),

    create_function: tool({
      description: "创建新函数",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().optional().default(""),
        code: z.string().describe("函数代码"),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(functions)
          .values({ ...params, agentId })
          .returning();
        return {
          function: row,
          _mutateKeys: [`/api/functions?agentId=${agentId}`],
        };
      },
    }),

    update_function: tool({
      description: "更新函数",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        code: z.string().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(functions)
          .set(updates)
          .where(and(eq(functions.id, id), eq(functions.agentId, agentId)))
          .returning();
        if (!row) return { error: "函数不存在" };
        return {
          function: row,
          _mutateKeys: [`/api/functions?agentId=${agentId}`],
        };
      },
    }),

    delete_function: tool({
      description: "删除函数",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(functions)
          .where(and(eq(functions.id, id), eq(functions.agentId, agentId)))
          .returning({ id: functions.id });
        if (!row) return { error: "函数不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/functions?agentId=${agentId}`],
        };
      },
    }),
  };
}
