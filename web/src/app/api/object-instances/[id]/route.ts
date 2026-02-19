import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectInstances, objectTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { extractLabel } from "@/lib/ontology/utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(objectInstances)
    .where(eq(objectInstances.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
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
    .from(objectInstances)
    .where(eq(objectInstances.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const mergedData = body.data
    ? { ...existing.data, ...body.data }
    : existing.data;

  // Re-extract label from merged data
  const [objType] = await db
    .select({ titleProperty: objectTypes.titleProperty })
    .from(objectTypes)
    .where(eq(objectTypes.id, existing.objectTypeId));

  const label = extractLabel(mergedData, objType?.titleProperty ?? null);

  const [updated] = await db
    .update(objectInstances)
    .set({
      data: mergedData,
      label,
    })
    .where(eq(objectInstances.id, id))
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
    .from(objectInstances)
    .where(eq(objectInstances.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(objectInstances).where(eq(objectInstances.id, id));
  return NextResponse.json({ ok: true });
}
