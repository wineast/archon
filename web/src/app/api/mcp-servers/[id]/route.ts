import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.id, id), isNull(mcpServers.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [updated] = await db
    .update(mcpServers)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.transportType !== undefined && { transportType: body.transportType }),
      ...(body.headers !== undefined && { headers: body.headers }),
      ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
    })
    .where(eq(mcpServers.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "mcp_server",
      resourceId: id,
      resourceKey: updated.key,
      resourceName: updated.name,
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.id, id), isNull(mcpServers.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(mcpServers).set({ deletedAt: new Date() }).where(eq(mcpServers.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "mcp_server",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
