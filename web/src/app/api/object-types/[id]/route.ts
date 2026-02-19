import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectTypes, objectRelations, objectInstances } from "@/db/schema";
import { eq, or, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(objectTypes)
    .where(and(eq(objectTypes.id, id), isNull(objectTypes.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Object type not found" }, { status: 404 });
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
    .from(objectTypes)
    .where(and(eq(objectTypes.id, id), isNull(objectTypes.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Object type not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [updated] = await db
    .update(objectTypes)
    .set({
      // key is NOT updatable
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.schemaId !== undefined && { schemaId: body.schemaId }),
      ...(body.titleProperty !== undefined && { titleProperty: body.titleProperty }),
      ...(body.source !== undefined && { source: body.source }),
      ...(body.externalConfig !== undefined && { externalConfig: body.externalConfig }),
      ...(body.order !== undefined && { order: body.order }),
    })
    .where(eq(objectTypes.id, id))
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
    .from(objectTypes)
    .where(and(eq(objectTypes.id, id), isNull(objectTypes.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Object type not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Check if any instances reference this type
  const [instanceCount] = await db
    .select({ count: objectInstances.id })
    .from(objectInstances)
    .where(eq(objectInstances.objectTypeId, id))
    .limit(1);

  if (instanceCount) {
    return NextResponse.json(
      {
        error: "Object type has instances. Delete all instances before deleting the type.",
      },
      { status: 400 }
    );
  }

  // Soft delete the object type and cascade soft delete related relations
  const now = new Date();
  await db.update(objectTypes).set({ deletedAt: now }).where(eq(objectTypes.id, id));
  await db.update(objectRelations).set({ deletedAt: now }).where(
    and(
      or(eq(objectRelations.sourceTypeId, id), eq(objectRelations.targetTypeId, id)),
      isNull(objectRelations.deletedAt)
    )
  );

  return NextResponse.json({ ok: true });
}
