import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { schemas } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole, requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(existing);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  // Pool resource (agentId IS NULL) → require super admin
  // Private resource → require agent editor role
  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [updated] = await db
    .update(schemas)
    .set({
      // key is NOT updatable
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.parameters !== undefined && { parameters: body.parameters }),
    })
    .where(eq(schemas.id, id))
    .returning();

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "updated",
        resourceType: "schema",
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
    .from(schemas)
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(schemas).set({ deletedAt: new Date() }).where(eq(schemas.id, id));

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "deleted",
        resourceType: "schema",
        resourceId: id,
        resourceKey: existing.key,
        resourceName: existing.name,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
