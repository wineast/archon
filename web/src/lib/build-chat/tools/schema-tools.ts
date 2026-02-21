import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { schemas } from "@/db/schema";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { eq, and } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

/** JSON Schema 7 validator for chat tool input. Allows arbitrary nesting. */
const jsonSchemaValidator: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string().optional(),
    description: z.string().optional(),
    default: z.unknown().optional(),
    const: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
    properties: z.record(z.string(), jsonSchemaValidator).optional(),
    required: z.array(z.string()).optional(),
    additionalProperties: z.union([z.boolean(), jsonSchemaValidator]).optional(),
    items: z.union([jsonSchemaValidator, z.array(jsonSchemaValidator)]).optional(),
    prefixItems: z.array(jsonSchemaValidator).optional(),
    minItems: z.number().optional(),
    maxItems: z.number().optional(),
    uniqueItems: z.boolean().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    format: z.string().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    oneOf: z.array(jsonSchemaValidator).optional(),
    anyOf: z.array(jsonSchemaValidator).optional(),
    allOf: z.array(jsonSchemaValidator).optional(),
    $ref: z.string().optional(),
    $defs: z.record(z.string(), jsonSchemaValidator).optional(),
  }).passthrough()
);

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
        parameters: jsonSchemaValidator.optional().default({ type: "object", properties: {}, required: [] }),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(schemas)
          .values({
            ...params,
            agentId,
            parameters: params.parameters as JsonSchema7,
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
        parameters: jsonSchemaValidator.optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const setValues: Record<string, unknown> = {};
        if (updates.key !== undefined) setValues.key = updates.key;
        if (updates.name !== undefined) setValues.name = updates.name;
        if (updates.description !== undefined) setValues.description = updates.description;
        if (updates.parameters) setValues.parameters = updates.parameters as JsonSchema7;
        const [row] = await db
          .update(schemas)
          .set(setValues)
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
