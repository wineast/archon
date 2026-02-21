import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createMCPClient } from "@ai-sdk/mcp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildMcpServerTools(agentId: string): Record<string, AnyTool> {
  return {
    list_mcp_servers: tool({
      description: "列出当前 Agent 的所有 MCP Server",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: mcpServers.id,
            key: mcpServers.key,
            name: mcpServers.name,
            description: mcpServers.description,
            url: mcpServers.url,
            transportType: mcpServers.transportType,
            enabled: mcpServers.enabled,
          })
          .from(mcpServers)
          .where(and(eq(mcpServers.agentId, agentId), isNull(mcpServers.deletedAt)));
        return { mcpServers: rows, _mutateKeys: [`/api/mcp-servers?agentId=${agentId}`] };
      },
    }),

    get_mcp_server: tool({
      description: "获取 MCP Server 详情",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .select()
          .from(mcpServers)
          .where(and(eq(mcpServers.id, id), eq(mcpServers.agentId, agentId), isNull(mcpServers.deletedAt)))
          .limit(1);
        if (!row) return { error: "MCP Server 不存在" };
        return { mcpServer: row, _mutateKeys: [] };
      },
    }),

    create_mcp_server: tool({
      description: "创建新的 MCP Server",
      inputSchema: z.object({
        key: z.string().describe("唯一标识，snake_case"),
        name: z.string().describe("显示名称"),
        description: z.string().optional().default(""),
        url: z.string().describe("MCP Server URL"),
        transportType: z.enum(["sse", "http"]).optional().default("sse"),
        enabled: z.boolean().optional().default(true),
      }),
      execute: async (params) => {
        const [row] = await db
          .insert(mcpServers)
          .values({ ...params, agentId })
          .returning();
        return {
          mcpServer: row,
          _mutateKeys: [`/api/mcp-servers?agentId=${agentId}`],
        };
      },
    }),

    update_mcp_server: tool({
      description: "更新 MCP Server",
      inputSchema: z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        description: z.string().optional(),
        url: z.string().optional(),
        transportType: z.enum(["sse", "http"]).optional(),
        headers: z.record(z.string(), z.string()).optional(),
        enabled: z.boolean().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const [row] = await db
          .update(mcpServers)
          .set(updates as Record<string, unknown>)
          .where(and(eq(mcpServers.id, id), eq(mcpServers.agentId, agentId)))
          .returning();
        if (!row) return { error: "MCP Server 不存在" };
        return {
          mcpServer: row,
          _mutateKeys: [`/api/mcp-servers?agentId=${agentId}`],
        };
      },
    }),

    delete_mcp_server: tool({
      description: "删除 MCP Server（软删除）",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [row] = await db
          .update(mcpServers)
          .set({ deletedAt: new Date() })
          .where(and(eq(mcpServers.id, id), eq(mcpServers.agentId, agentId)))
          .returning({ id: mcpServers.id });
        if (!row) return { error: "MCP Server 不存在" };
        return {
          deleted: true,
          _mutateKeys: [`/api/mcp-servers?agentId=${agentId}`],
        };
      },
    }),

    test_mcp_server: tool({
      description: "测试 MCP Server 连接，返回可用工具列表",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const [server] = await db
          .select()
          .from(mcpServers)
          .where(and(eq(mcpServers.id, id), eq(mcpServers.agentId, agentId), isNull(mcpServers.deletedAt)))
          .limit(1);
        if (!server) return { error: "MCP Server 不存在" };
        if (!server.url) return { ok: false, error: "URL 未配置" };

        let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
        try {
          client = await createMCPClient({
            transport: {
              type: server.transportType as "sse" | "http",
              url: server.url,
              headers: server.headers && Object.keys(server.headers).length > 0
                ? server.headers
                : undefined,
            },
          });
          const toolSet = await client.tools();
          const toolNames = Object.keys(toolSet);
          return { ok: true, tools: toolNames, toolCount: toolNames.length, _mutateKeys: [] };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e), _mutateKeys: [] };
        } finally {
          if (client) await client.close().catch(() => {});
        }
      },
    }),
  };
}
