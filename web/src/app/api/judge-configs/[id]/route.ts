import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { judgeConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(judgeConfigs)
    .where(and(eq(judgeConfigs.id, id), isNull(judgeConfigs.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Judge config not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(judgeConfigs)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.dimensions !== undefined && { dimensions: body.dimensions }),
    })
    .where(eq(judgeConfigs.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "judge_config",
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
    .from(judgeConfigs)
    .where(and(eq(judgeConfigs.id, id), isNull(judgeConfigs.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Judge config not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (existing.isActive) {
    return NextResponse.json(
      { error: "Cannot delete the active config" },
      { status: 400 }
    );
  }

  await db.update(judgeConfigs).set({ deletedAt: new Date() }).where(eq(judgeConfigs.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "judge_config",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
