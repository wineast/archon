import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildWikiTools(agentId: string): Record<string, AnyTool> {
  return {
    list_wiki: tool({
      description: "列出当前 Agent 的所有 Wiki 文档",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: wikiDocuments.id,
            key: wikiDocuments.key,
            title: wikiDocuments.title,
            parentId: wikiDocuments.parentId,
            order: wikiDocuments.order,
          })
          .from(wikiDocuments)
          .where(eq(wikiDocuments.agentId, agentId));
        return { wiki: rows, _mutateKeys: [`/api/wiki?agentId=${agentId}`] };
      },
    }),

    get_wiki: tool({
      description: "获取 Wiki 文档详情，包含 content 大字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(wikiDocuments)
          .where(and(eq(wikiDocuments.id, id), eq(wikiDocuments.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "Wiki 文档不存在" };
        return { wiki: row, _mutateKeys: [] };
      },
    }),

    create_wiki: tool({
      description: "创建新 Wiki 文档",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        title: z.string().describe("文档标题"),
        content: z.string().optional().default(""),
        parentId: z.string().uuid().optional().describe("父文档 ID"),
        order: z.number().optional().default(0),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(wikiDocuments)
          .values({ ...params, agentId })
          .returning();
        return {
          wiki: row,
          _mutateKeys: [`/api/wiki?agentId=${agentId}`],
        };
      },
    }),

    update_wiki: tool({
      description: "更新 Wiki 文档",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        parentId: z.string().uuid().nullable().optional(),
        order: z.number().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(wikiDocuments)
          .set(updates)
          .where(and(eq(wikiDocuments.id, id), eq(wikiDocuments.agentId, agentId)))
          .returning();
        if (!row) return { error: "Wiki 文档不存在" };
        return {
          wiki: row,
          _mutateKeys: [`/api/wiki?agentId=${agentId}`],
        };
      },
    }),

    delete_wiki: tool({
      description: "删除 Wiki 文档",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(wikiDocuments)
          .where(and(eq(wikiDocuments.id, id), eq(wikiDocuments.agentId, agentId)))
          .returning({ id: wikiDocuments.id });
        if (!row) return { error: "Wiki 文档不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/wiki?agentId=${agentId}`],
        };
      },
    }),
  };
}
