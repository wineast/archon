import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildToolTools(agentId: string): Record<string, AnyTool> {
  return {
    list_tools: tool({
      description: "列出当前 Agent 的所有工具",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: tools.id,
            key: tools.key,
            name: tools.name,
            description: tools.description,
            enabled: tools.enabled,
            executionTarget: tools.executionTarget,
          })
          .from(tools)
          .where(eq(tools.agentId, agentId));
        return { tools: rows, _mutateKeys: [`/api/tools?agentId=${agentId}`] };
      },
    }),

    get_tool: tool({
      description: "获取工具详情，包含 handler、output 等大字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(tools)
          .where(and(eq(tools.id, id), eq(tools.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "工具不存在" };
        return { tool: row, _mutateKeys: [] };
      },
    }),

    create_tool: tool({
      description: "创建新工具",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().describe("工具描述"),
        handler: z.string().optional().describe("执行代码或 URL"),
        output: z.string().optional().describe("输出模板 (LiquidJS)"),
        enabled: z.boolean().optional().default(true),
        executionTarget: z
          .enum(["server", "client", "host"])
          .optional()
          .default("server"),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(tools)
          .values({ ...params, agentId })
          .returning();
        return {
          tool: row,
          _mutateKeys: [`/api/tools?agentId=${agentId}`],
        };
      },
    }),

    update_tool: tool({
      description: "更新工具",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        handler: z.string().optional(),
        output: z.string().optional(),
        enabled: z.boolean().optional(),
        executionTarget: z.enum(["server", "client", "host"]).optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(tools)
          .set(updates)
          .where(and(eq(tools.id, id), eq(tools.agentId, agentId)))
          .returning();
        if (!row) return { error: "工具不存在" };
        return {
          tool: row,
          _mutateKeys: [`/api/tools?agentId=${agentId}`],
        };
      },
    }),

    delete_tool: tool({
      description: "删除工具",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(tools)
          .where(and(eq(tools.id, id), eq(tools.agentId, agentId)))
          .returning({ id: tools.id });
        if (!row) return { error: "工具不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/tools?agentId=${agentId}`],
        };
      },
    }),
  };
}
