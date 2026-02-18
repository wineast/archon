import { NextResponse } from "next/server";
import { db } from "@/db";
import { functionTestCases } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const { id, caseId } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(functionTestCases)
    .where(
      and(
        eq(functionTestCases.id, caseId),
        eq(functionTestCases.functionId, id)
      )
    );

  if (!existing) {
    return NextResponse.json(
      { error: "Test case not found" },
      { status: 404 }
    );
  }

  const [updated] = await db
    .update(functionTestCases)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.input !== undefined && { input: body.input }),
      ...(body.expectedOutput !== undefined && {
        expectedOutput: body.expectedOutput,
      }),
      ...(body.tags !== undefined && { tags: body.tags }),
    })
    .where(eq(functionTestCases.id, caseId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const { id, caseId } = await params;

  const [existing] = await db
    .select()
    .from(functionTestCases)
    .where(
      and(
        eq(functionTestCases.id, caseId),
        eq(functionTestCases.functionId, id)
      )
    );

  if (!existing) {
    return NextResponse.json(
      { error: "Test case not found" },
      { status: 404 }
    );
  }

  await db
    .delete(functionTestCases)
    .where(eq(functionTestCases.id, caseId));

  return NextResponse.json({ ok: true });
}
