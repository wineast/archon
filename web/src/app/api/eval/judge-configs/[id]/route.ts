import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalJudgeConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(evalJudgeConfigs)
    .where(eq(evalJudgeConfigs.id, id));

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
    .where(eq(evalJudgeConfigs.id, id));

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

  await db.delete(evalJudgeConfigs).where(eq(evalJudgeConfigs.id, id));
  return NextResponse.json({ ok: true });
}
