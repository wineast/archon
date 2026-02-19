import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalCases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(evalCases)
    .where(eq(evalCases.id, id));

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
      ...(body.input !== undefined && { input: body.input }),
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
    .where(eq(evalCases.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(evalCases).where(eq(evalCases.id, id));
  return NextResponse.json({ ok: true });
}
