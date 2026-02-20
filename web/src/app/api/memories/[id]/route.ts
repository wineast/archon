import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
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
    .from(memories)
    .where(and(eq(memories.id, id), isNull(memories.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [updated] = await db
    .update(memories)
    .set({
      ...(body.type !== undefined && { type: body.type }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.importance !== undefined && { importance: body.importance }),
      ...(body.userId !== undefined && { userId: body.userId }),
      ...(body.expiresAt !== undefined && {
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      }),
      ...(body.metadata !== undefined && { metadata: body.metadata }),
    })
    .where(eq(memories.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "memory",
      resourceId: id,
      resourceKey: updated.type,
      resourceName: updated.content.slice(0, 50),
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
    .from(memories)
    .where(and(eq(memories.id, id), isNull(memories.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db
    .update(memories)
    .set({ deletedAt: new Date() })
    .where(eq(memories.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "memory",
      resourceId: id,
      resourceKey: existing.type,
      resourceName: existing.content.slice(0, 50),
    });
  });

  return NextResponse.json({ ok: true });
}
