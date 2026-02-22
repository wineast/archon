import { join } from "path";
import { mcpServers } from "../schema";
import { logSection, log, readJson } from "../seed-utils";
import type { Seeder } from "./types";

interface McpServerSeed {
  key: string;
  name: string;
  description: string;
  url: string;
  transportType: "sse" | "http";
  headers: Record<string, string>;
  enabled: boolean;
}

export const seedMcpServers: Seeder = {
  name: "mcp-servers",
  async run(ctx) {
    logSection("Seeding MCP servers");

    const servers = readJson<McpServerSeed[]>(
      join(ctx.agentDir, "mcp-servers.json")
    );

    for (const s of servers) {
      const [row] = await ctx.db
        .insert(mcpServers)
        .values({
          agentId: ctx.agentId,
          versionId: ctx.versionId,
          key: s.key,
          name: s.name,
          description: s.description,
          url: s.url,
          transportType: s.transportType,
          headers: s.headers,
          enabled: s.enabled,
        })
        .onConflictDoUpdate({
          target: [mcpServers.versionId, mcpServers.key],
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
