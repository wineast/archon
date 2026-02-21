import { mcpServers } from "../schema";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

const MCP_SERVERS_SEED: Array<{
  key: string;
  name: string;
  description: string;
  url: string;
  transportType: "sse" | "http";
  headers: Record<string, string>;
  enabled: boolean;
}> = [
  {
    key: "weather",
    name: "Weather Service",
    description: "Real-time weather data provider. Provides current conditions, forecasts, and historical weather data for any location worldwide.",
    url: "https://mcp-weather.example.com/sse",
    transportType: "sse" as const,
    headers: { "X-API-Key": "demo-weather-key-123" },
    enabled: true,
  },
  {
    key: "knowledge_base",
    name: "Knowledge Base",
    description: "Internal knowledge base search service. Allows querying company documents, FAQs, and product manuals.",
    url: "https://mcp-kb.example.com/mcp",
    transportType: "http" as const,
    headers: {
      Authorization: "Bearer kb-token-abc",
      "X-Tenant": "demo",
    },
    enabled: true,
  },
  {
    key: "erp_connector",
    name: "ERP Connector",
    description: "Enterprise resource planning system connector. Query inventory, orders, and customer data from the ERP system.",
    url: "https://erp.internal.example.com/mcp/sse",
    transportType: "sse" as const,
    headers: {},
    enabled: false,
  },
];

export const seedMcpServers: Seeder = {
  name: "mcp-servers",
  async run(ctx) {
    logSection("Seeding MCP servers");

    for (const s of MCP_SERVERS_SEED) {
      const [row] = await ctx.db
        .insert(mcpServers)
        .values({
          agentId: ctx.agentId,
          key: s.key,
          name: s.name,
          description: s.description,
          url: s.url,
          transportType: s.transportType,
          headers: s.headers,
          enabled: s.enabled,
        })
        .onConflictDoUpdate({
          target: [mcpServers.agentId, mcpServers.key],
          set: {
            name: s.name,
            description: s.description,
            url: s.url,
            transportType: s.transportType,
            headers: s.headers,
            enabled: s.enabled,
          },
        })
        .returning();
      log("info", `${row.name} (${row.id}) ${row.enabled ? "✓" : "○"}`);
    }
  },
};
