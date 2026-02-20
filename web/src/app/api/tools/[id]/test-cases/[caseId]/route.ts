import { NextResponse } from "next/server";
import { db } from "@/db";
import { toolTestCases } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const { id, caseId } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(toolTestCases)
    .where(
      and(
        eq(toolTestCases.id, caseId),
        eq(toolTestCases.toolId, id)
      )
    );

  if (!existing) {
    return NextResponse.json(
      { error: "Test case not found" },
      { status: 404 }
    );
  }

  const [updated] = await db
    .update(toolTestCases)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.input !== undefined && { input: body.input }),
      ...(body.expectedOutput !== undefined && {
        expectedOutput: body.expectedOutput,
      }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.showAsExample !== undefined && { showAsExample: body.showAsExample }),
    })
    .where(eq(toolTestCases.id, caseId))
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
    .from(toolTestCases)
    .where(
      and(
        eq(toolTestCases.id, caseId),
        eq(toolTestCases.toolId, id)
      )
    );

  if (!existing) {
    return NextResponse.json(
      { error: "Test case not found" },
      { status: 404 }
    );
  }

  await db
    .delete(toolTestCases)
    .where(eq(toolTestCases.id, caseId));

  return NextResponse.json({ ok: true });
}
