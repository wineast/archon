import { NextResponse } from "next/server";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole, requireSuperAdmin } from "@/lib/auth/require-agent-role";
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

  const ctx = server.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(server.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Accept optional overrides from body (test unsaved form values)
  const body = await req.json().catch(() => null);
  const url = body?.url ?? server.url;
  const transportType = body?.transportType ?? server.transportType;
  const headers = body?.headers ?? server.headers;

  if (!url) {
    return NextResponse.json({ ok: false, error: "URL is not configured" }, { status: 400 });
  }

  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  try {
    client = await createMCPClient({
      transport: {
        type: transportType as "sse" | "http",
        url,
        headers: headers && Object.keys(headers).length > 0
          ? headers
          : undefined,
      },
    });

    const result = await client.listTools();
    const tools = result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    return NextResponse.json({
      ok: true,
      tools,
      toolCount: tools.length,
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
