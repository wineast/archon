import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { objectTypes, objectRelations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveEditingVersionId } from "@/lib/versions/resolve";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

const typesMutateKey = (agentId: string) =>
  `/api/object-types?agentId=${agentId}`;
const relationsMutateKey = (agentId: string) =>
  `/api/object-relations?agentId=${agentId}`;

export function buildOntologyTools(agentId: string): Record<string, AnyTool> {
  return {
    list_object_types: tool({
      description: "列出当前 Agent 的所有对象类型",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: objectTypes.id,
            key: objectTypes.key,
            name: objectTypes.name,
            description: objectTypes.description,
            icon: objectTypes.icon,
            color: objectTypes.color,
            order: objectTypes.order,
          })
          .from(objectTypes)
          .where(eq(objectTypes.agentId, agentId));
        return { objectTypes: rows, _mutateKeys: [typesMutateKey(agentId)] };
      },
    }),

    get_object_type: tool({
      description: "获取对象类型详情",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(objectTypes)
          .where(and(eq(objectTypes.id, id), eq(objectTypes.agentId, agentId)))
          .limit(1);
        if (!row) return { error: "对象类型不存在" };
        return { objectType: row, _mutateKeys: [] };
      },
    }),

    create_object_type: tool({
      description: "创建新对象类型",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().optional().default(""),
        icon: z.string().optional().default("box"),
        color: z.string().optional().default("#6366f1"),
        order: z.number().optional().default(0),
      }),
      execute: async (params) => {
        const versionId = await resolveEditingVersionId(agentId);
        const [row] = await db
          .insert(objectTypes)
          .values({ ...params, agentId, versionId })
          .returning();
        return { objectType: row, _mutateKeys: [typesMutateKey(agentId)] };
      },
    }),

    update_object_type: tool({
      description: "更新对象类型",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        order: z.number().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(objectTypes)
          .set(updates)
          .where(and(eq(objectTypes.id, id), eq(objectTypes.agentId, agentId)))
          .returning();
        if (!row) return { error: "对象类型不存在" };
        return { objectType: row, _mutateKeys: [typesMutateKey(agentId)] };
      },
    }),

    delete_object_type: tool({
      description: "删除对象类型",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(objectTypes)
          .where(and(eq(objectTypes.id, id), eq(objectTypes.agentId, agentId)))
          .returning({ id: objectTypes.id });
        if (!row) return { error: "对象类型不存在" };
        return {
          deleted: true,
          _mutateKeys: [typesMutateKey(agentId), relationsMutateKey(agentId)],
        };
      },
    }),

    list_object_relations: tool({
      description: "列出当前 Agent 的所有对象关系",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: objectRelations.id,
            key: objectRelations.key,
            name: objectRelations.name,
            description: objectRelations.description,
            sourceTypeId: objectRelations.sourceTypeId,
            targetTypeId: objectRelations.targetTypeId,
            relationType: objectRelations.relationType,
            inverseName: objectRelations.inverseName,
            order: objectRelations.order,
          })
          .from(objectRelations)
          .where(eq(objectRelations.agentId, agentId));
        return {
          objectRelations: rows,
          _mutateKeys: [relationsMutateKey(agentId)],
        };
      },
    }),

    create_object_relation: tool({
      description: "创建新对象关系",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("关系名称"),
        description: z.string().optional().default(""),
        sourceTypeId: z.string().uuid().describe("源对象类型 ID"),
        targetTypeId: z.string().uuid().describe("目标对象类型 ID"),
        relationType: z
          .enum(["has_one", "has_many", "belongs_to", "many_to_many"])
          .describe("关系类型"),
        inverseName: z.string().optional().default(""),
        order: z.number().optional().default(0),
      }),
      execute: async (params) => {
        const versionId = await resolveEditingVersionId(agentId);
        const [row] = await db
          .insert(objectRelations)
          .values({ ...params, agentId, versionId })
          .returning();
        return {
          objectRelation: row,
          _mutateKeys: [relationsMutateKey(agentId)],
        };
      },
    }),

    update_object_relation: tool({
      description: "更新对象关系",
      inputSchema: z.object({
        id: z.string().uuid(),
        key: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        sourceTypeId: z.string().uuid().optional(),
        targetTypeId: z.string().uuid().optional(),
        relationType: z
          .enum(["has_one", "has_many", "belongs_to", "many_to_many"])
          .optional(),
        inverseName: z.string().optional(),
        order: z.number().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(objectRelations)
          .set(updates)
          .where(
            and(
              eq(objectRelations.id, id),
              eq(objectRelations.agentId, agentId)
            )
          )
          .returning();
        if (!row) return { error: "对象关系不存在" };
        return {
          objectRelation: row,
          _mutateKeys: [relationsMutateKey(agentId)],
        };
      },
    }),

    delete_object_relation: tool({
      description: "删除对象关系",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .delete(objectRelations)
          .where(
            and(
              eq(objectRelations.id, id),
              eq(objectRelations.agentId, agentId)
            )
          )
          .returning({ id: objectRelations.id });
        if (!row) return { error: "对象关系不存在" };
        return {
          deleted: true,
          _mutateKeys: [relationsMutateKey(agentId)],
        };
      },
    }),
  };
}
