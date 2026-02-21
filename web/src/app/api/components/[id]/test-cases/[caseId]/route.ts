import { NextResponse } from "next/server";
import { db } from "@/db";
import { componentTestCases } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const { id, caseId } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(componentTestCases)
    .where(
      and(
        eq(componentTestCases.id, caseId),
        eq(componentTestCases.componentId, id)
      )
    );

  if (!existing) {
    return NextResponse.json(
      { error: "Test case not found" },
      { status: 404 }
    );
  }

  const [updated] = await db
    .update(componentTestCases)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.data !== undefined && { data: body.data }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.showAsExample !== undefined && { showAsExample: body.showAsExample }),
    })
    .where(eq(componentTestCases.id, caseId))
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
    .from(componentTestCases)
    .where(
      and(
        eq(componentTestCases.id, caseId),
        eq(componentTestCases.componentId, id)
      )
    );

  if (!existing) {
    return NextResponse.json(
      { error: "Test case not found" },
      { status: 404 }
    );
  }

  await db
    .delete(componentTestCases)
    .where(eq(componentTestCases.id, caseId));

  return NextResponse.json({ ok: true });
}
