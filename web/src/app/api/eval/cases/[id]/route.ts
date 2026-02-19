import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalCases } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(evalCases)
    .where(and(eq(evalCases.id, id), isNull(evalCases.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(evalCases)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.mode !== undefined && { mode: body.mode }),
      ...(body.turns !== undefined && { turns: body.turns }),
      ...(body.expectedOutput !== undefined && {
        expectedOutput: body.expectedOutput,
      }),
      ...(body.assertions !== undefined && { assertions: body.assertions }),
      ...(body.tags !== undefined && { tags: body.tags }),
    })
    .where(eq(evalCases.id, id))
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
    .from(evalCases)
    .where(and(eq(evalCases.id, id), isNull(evalCases.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(evalCases).set({ deletedAt: new Date() }).where(eq(evalCases.id, id));
  return NextResponse.json({ ok: true });
}
