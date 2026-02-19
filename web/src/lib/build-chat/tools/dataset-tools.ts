import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import type { NewDatasetRow } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildDatasetTools(agentId: string): Record<string, AnyTool> {
  return {
    list_datasets: tool({
      description: "列出当前 Agent 的所有数据集",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: datasets.id,
            key: datasets.key,
            name: datasets.name,
            description: datasets.description,
          })
          .from(datasets)
          .where(eq(datasets.agentId, agentId));
        return { datasets: rows, _mutateKeys: [`/api/datasets?agentId=${agentId}`] };
      },
    }),

    get_dataset: tool({
      description: "获取数据集详情，包含 data 大字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(datasets)
          .where(and(eq(datasets.id, id), eq(datasets.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "数据集不存在" };
        return { dataset: row, _mutateKeys: [] };
      },
    }),

    create_dataset: tool({
      description: "创建新数据集",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().optional().default(""),
        data: z
          .record(z.string(), z.unknown())
          .describe("数据内容，JSON 对象（两层结构）"),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(datasets)
          .values({
            key: params.key,
            name: params.name,
            description: params.description,
            data: params.data as NewDatasetRow["data"],
            agentId,
          })
          .returning();
        return {
          dataset: row,
          _mutateKeys: [`/api/datasets?agentId=${agentId}`],
        };
      },
    }),

    update_dataset: tool({
      description: "更新数据集",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(datasets)
          .set(updates as Partial<NewDatasetRow>)
          .where(and(eq(datasets.id, id), eq(datasets.agentId, agentId)))
          .returning();
        if (!row) return { error: "数据集不存在" };
        return {
          dataset: row,
          _mutateKeys: [`/api/datasets?agentId=${agentId}`],
        };
      },
    }),

    delete_dataset: tool({
      description: "删除数据集",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(datasets)
          .where(and(eq(datasets.id, id), eq(datasets.agentId, agentId)))
          .returning({ id: datasets.id });
        if (!row) return { error: "数据集不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/datasets?agentId=${agentId}`],
        };
      },
    }),
  };
}
