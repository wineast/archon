import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(modelConfigs)
    .where(and(eq(modelConfigs.id, id), isNull(modelConfigs.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Model config not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(modelConfigs)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.modelId !== undefined && { modelId: body.modelId }),
      ...(body.systemPrompt !== undefined && {
        systemPrompt: body.systemPrompt,
      }),
      ...(body.temperature !== undefined && { temperature: body.temperature }),
    })
    .where(eq(modelConfigs.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(modelConfigs)
    .where(and(eq(modelConfigs.id, id), isNull(modelConfigs.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Model config not found" },
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

  await db.update(modelConfigs).set({ deletedAt: new Date() }).where(eq(modelConfigs.id, id));
  return NextResponse.json({ ok: true });
}
