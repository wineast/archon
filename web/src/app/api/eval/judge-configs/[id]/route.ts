import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { evalJudgeConfigs } from "@/db/schema";
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
    .from(evalJudgeConfigs)
    .where(and(eq(evalJudgeConfigs.id, id), isNull(evalJudgeConfigs.deletedAt)));

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
    .update(evalJudgeConfigs)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.model !== undefined && { model: body.model }),
      ...(body.systemPrompt !== undefined && {
        systemPrompt: body.systemPrompt,
      }),
      ...(body.temperature !== undefined && { temperature: body.temperature }),
      ...(body.dimensions !== undefined && { dimensions: body.dimensions }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
    })
    .where(eq(evalJudgeConfigs.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "eval_judge_config",
      resourceId: id,
      resourceKey: updated.key,
      resourceName: updated.name,
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(evalJudgeConfigs)
    .where(and(eq(evalJudgeConfigs.id, id), isNull(evalJudgeConfigs.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Judge config not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (existing.isDefault) {
    return NextResponse.json(
      { error: "Cannot delete the default judge config" },
      { status: 400 }
    );
  }

  await db.update(evalJudgeConfigs).set({ deletedAt: new Date() }).where(eq(evalJudgeConfigs.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "eval_judge_config",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
