import { NextResponse } from "next/server";
import { db } from "@/db";
import { functions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { clearFunctionCache } from "@/lib/functions/compile";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(functions)
    .where(eq(functions.id, id));

  if (!row) {
    return NextResponse.json(
      { error: "Function not found" },
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
    .from(functions)
    .where(eq(functions.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Function not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(functions)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.parameters !== undefined && { parameters: body.parameters }),
      ...(body.returnParameters !== undefined && { returnParameters: body.returnParameters }),
    })
    .where(eq(functions.id, id))
    .returning();

  if (existing.agentId) {
    clearFunctionCache(existing.agentId);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(functions)
    .where(eq(functions.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Function not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(functions).where(eq(functions.id, id));

  if (existing.agentId) {
    clearFunctionCache(existing.agentId);
  }

  return NextResponse.json({ ok: true });
}
