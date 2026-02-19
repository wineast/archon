import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { schemas } from "@/db/schema";
import type { ToolParameter } from "@/lib/tools/types";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

const parameterSchema = z.object({
  id: z.string().optional().default(""),
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "enum", "json"]),
  description: z.string().optional().default(""),
  required: z.boolean().optional().default(false),
  isArray: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
});

export function buildSchemaTools(agentId: string): Record<string, AnyTool> {
  return {
    list_schemas: tool({
      description: "列出当前 Agent 的所有 Schema",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: schemas.id,
            key: schemas.key,
            name: schemas.name,
            description: schemas.description,
          })
          .from(schemas)
          .where(eq(schemas.agentId, agentId));
        return { schemas: rows, _mutateKeys: [`/api/schemas?agentId=${agentId}`] };
      },
    }),

    get_schema: tool({
      description: "获取 Schema 详情，包含 parameters 字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(schemas)
          .where(and(eq(schemas.id, id), eq(schemas.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "Schema 不存在" };
        return { schema: row, _mutateKeys: [] };
      },
    }),

    create_schema: tool({
      description: "创建新 Schema",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().optional().default(""),
        parameters: z.array(parameterSchema).optional().default([]),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(schemas)
          .values({
            ...params,
            agentId,
            parameters: params.parameters as ToolParameter[],
          })
          .returning();
        return {
          schema: row,
          _mutateKeys: [`/api/schemas?agentId=${agentId}`],
        };
      },
    }),

    update_schema: tool({
      description: "更新 Schema",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        parameters: z.array(parameterSchema).optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(schemas)
          .set({
            ...updates,
            ...(updates.parameters
              ? { parameters: updates.parameters as ToolParameter[] }
              : {}),
          })
          .where(and(eq(schemas.id, id), eq(schemas.agentId, agentId)))
          .returning();
        if (!row) return { error: "Schema 不存在" };
        return {
          schema: row,
          _mutateKeys: [`/api/schemas?agentId=${agentId}`],
        };
      },
    }),

    delete_schema: tool({
      description: "删除 Schema",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(schemas)
          .where(and(eq(schemas.id, id), eq(schemas.agentId, agentId)))
          .returning({ id: schemas.id });
        if (!row) return { error: "Schema 不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/schemas?agentId=${agentId}`],
        };
      },
    }),
  };
}
