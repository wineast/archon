import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole, requireSuperAdmin } from "@/lib/auth/require-agent-role";
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

  // Pool resource (agentId IS NULL) → require super admin
  // Private resource → require agent editor role
  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
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

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "updated",
        resourceType: "mcp_server",
        resourceId: id,
        resourceKey: updated.key,
        resourceName: updated.name,
      });
    });
  }

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

  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(mcpServers).set({ deletedAt: new Date() }).where(eq(mcpServers.id, id));

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "deleted",
        resourceType: "mcp_server",
        resourceId: id,
        resourceKey: existing.key,
        resourceName: existing.name,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
