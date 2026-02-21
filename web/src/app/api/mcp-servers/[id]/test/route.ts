import { NextResponse } from "next/server";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { createMCPClient } from "@ai-sdk/mcp";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [server] = await db
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.id, id), isNull(mcpServers.deletedAt)));

  if (!server) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(server.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (!server.url) {
    return NextResponse.json({ ok: false, error: "URL is not configured" }, { status: 400 });
  }

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

    return NextResponse.json({
      ok: true,
      tools: toolNames,
      toolCount: toolNames.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}
