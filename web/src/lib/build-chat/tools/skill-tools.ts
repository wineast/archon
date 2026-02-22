import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { skills } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveEditingVersionId } from "@/lib/versions/resolve";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildSkillTools(agentId: string): Record<string, AnyTool> {
  return {
    list_skills: tool({
      description: "列出当前 Agent 的所有技能",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: skills.id,
            key: skills.key,
            name: skills.name,
            description: skills.description,
            enabled: skills.enabled,
            order: skills.order,
          })
          .from(skills)
          .where(eq(skills.agentId, agentId));
        return { skills: rows, _mutateKeys: [`/api/skills?agentId=${agentId}`] };
      },
    }),

    get_skill: tool({
      description: "获取技能详情，包含 content 等大字段",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(skills)
          .where(and(eq(skills.id, id), eq(skills.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "技能不存在" };
        return { skill: row, _mutateKeys: [] };
      },
    }),

    create_skill: tool({
      description: "创建新技能",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().describe("技能描述"),
        content: z.string().optional().describe("技能完整内容（支持 LiquidJS 模板）"),
        enabled: z.boolean().optional().default(true),
        order: z.number().optional().default(0),
      }),
      execute: async (params) => {
        const versionId = await resolveEditingVersionId(agentId);
        const [row] = await db
          .insert(skills)
          .values({ ...params, agentId, versionId })
          .returning();
        return {
          skill: row,
          _mutateKeys: [`/api/skills?agentId=${agentId}`],
        };
      },
    }),

    update_skill: tool({
      description: "更新技能",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        enabled: z.boolean().optional(),
        order: z.number().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(skills)
          .set(updates)
          .where(and(eq(skills.id, id), eq(skills.agentId, agentId)))
          .returning();
        if (!row) return { error: "技能不存在" };
        return {
          skill: row,
          _mutateKeys: [`/api/skills?agentId=${agentId}`],
        };
      },
    }),

    delete_skill: tool({
      description: "删除技能",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(skills)
          .where(and(eq(skills.id, id), eq(skills.agentId, agentId)))
          .returning({ id: skills.id });
        if (!row) return { error: "技能不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/skills?agentId=${agentId}`],
        };
      },
    }),
  };
}
