import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { schemas } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
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

  const ctx = await requireAgentRole(existing.agentId, "viewer");
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

  const ctx = await requireAgentRole(existing.agentId, "editor");
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

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "schema",
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
    .from(schemas)
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(schemas).set({ deletedAt: new Date() }).where(eq(schemas.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "schema",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
