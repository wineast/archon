import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(datasets)
    .where(eq(datasets.id, id));

  if (!row) {
    return NextResponse.json(
      { error: "Dataset not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(row.agentId!, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(datasets)
    .where(eq(datasets.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Dataset not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(datasets)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.layer !== undefined && { layer: body.layer }),
      ...(body.data !== undefined && { data: body.data }),
    })
    .where(eq(datasets.id, id))
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
    .from(datasets)
    .where(eq(datasets.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Dataset not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(datasets).where(eq(datasets.id, id));
  return NextResponse.json({ ok: true });
}
