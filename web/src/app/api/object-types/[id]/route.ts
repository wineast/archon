import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectTypes, objectRelations } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(objectTypes)
    .where(eq(objectTypes.id, id));

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
    .where(eq(objectTypes.id, id));

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
    .where(eq(objectTypes.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Object type not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Check if any relations reference this type
  const referencingRelations = await db
    .select({ id: objectRelations.id, name: objectRelations.name })
    .from(objectRelations)
    .where(
      or(
        eq(objectRelations.sourceTypeId, id),
        eq(objectRelations.targetTypeId, id)
      )
    );

  if (referencingRelations.length > 0) {
    const names = referencingRelations.map((r) => r.name).join(", ");
    return NextResponse.json(
      {
        error: `Object type is referenced by relations: ${names}. Remove relations before deleting.`,
      },
      { status: 400 }
    );
  }

  await db.delete(objectTypes).where(eq(objectTypes.id, id));
  return NextResponse.json({ ok: true });
}
