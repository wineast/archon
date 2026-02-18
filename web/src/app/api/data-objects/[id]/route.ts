import { NextResponse } from "next/server";
import { db } from "@/db";
import { dataObjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [obj] = await db
    .select()
    .from(dataObjects)
    .where(eq(dataObjects.id, id));

  if (!obj) {
    return NextResponse.json(
      { error: "Data object not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(obj.agentId!, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(obj);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(dataObjects)
    .where(eq(dataObjects.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Data object not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(dataObjects)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.data !== undefined && { data: body.data }),
    })
    .where(eq(dataObjects.id, id))
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
    .from(dataObjects)
    .where(eq(dataObjects.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Data object not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(dataObjects).where(eq(dataObjects.id, id));
  return NextResponse.json({ ok: true });
}
