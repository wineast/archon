import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import type { McpServerRow } from "@/db/schema";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";
import { getAgentResources } from "@/lib/pool/queries";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await getAgentResources<McpServerRow>(agentId, "mcp-server");
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const agentId = body.agentId;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .insert(mcpServers)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      url: body.url ?? "",
      transportType: body.transportType ?? "sse",
      headers: body.headers ?? {},
      enabled: body.enabled ?? true,
    })
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "mcp_server",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(row, { status: 201 });
}
