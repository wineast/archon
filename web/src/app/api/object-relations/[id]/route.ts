import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectRelations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(objectRelations)
    .where(eq(objectRelations.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Relation not found" }, { status: 404 });
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
    .from(objectRelations)
    .where(eq(objectRelations.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Relation not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [updated] = await db
    .update(objectRelations)
    .set({
      // key is NOT updatable
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.sourceTypeId !== undefined && { sourceTypeId: body.sourceTypeId }),
      ...(body.targetTypeId !== undefined && { targetTypeId: body.targetTypeId }),
      ...(body.relationType !== undefined && { relationType: body.relationType }),
      ...(body.inverseName !== undefined && { inverseName: body.inverseName }),
      ...(body.order !== undefined && { order: body.order }),
    })
    .where(eq(objectRelations.id, id))
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
    .from(objectRelations)
    .where(eq(objectRelations.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Relation not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(objectRelations).where(eq(objectRelations.id, id));
  return NextResponse.json({ ok: true });
}
