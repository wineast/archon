import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Model config not found" },
      { status: 404 }
    );
  }

  const [updated] = await db
    .update(modelConfigs)
    .set({
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
    .where(eq(modelConfigs.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Model config not found" },
      { status: 404 }
    );
  }

  if (existing.isActive) {
    return NextResponse.json(
      { error: "Cannot delete the active config" },
      { status: 400 }
    );
  }

  await db.delete(modelConfigs).where(eq(modelConfigs.id, id));
  return NextResponse.json({ ok: true });
}
