import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { skills } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)));

  if (!row) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(row.agentId!, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [updated] = await db
    .update(skills)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.content !== undefined && { content: body.content }),
      ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
      ...(body.order !== undefined && { order: body.order }),
    })
    .where(eq(skills.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "skill",
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
    .from(skills)
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(skills).set({ deletedAt: new Date() }).where(eq(skills.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "skill",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
