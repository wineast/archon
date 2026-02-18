import { NextResponse } from "next/server";
import { db } from "@/db";
import { toolTestCases, tools } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(toolTestCases)
    .where(eq(toolTestCases.toolId, id));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify tool exists
  const [tool] = await db
    .select({ id: tools.id })
    .from(tools)
    .where(eq(tools.id, id));

  if (!tool) {
    return NextResponse.json(
      { error: "Tool not found" },
      { status: 404 }
    );
  }

  const body = await req.json();

  const [row] = await db
    .insert(toolTestCases)
    .values({
      toolId: id,
      name: body.name ?? "Untitled",
      input: body.input ?? {},
      expectedOutput: body.expectedOutput ?? null,
      tags: body.tags ?? [],
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
