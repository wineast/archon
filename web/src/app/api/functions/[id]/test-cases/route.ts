import { NextResponse } from "next/server";
import { db } from "@/db";
import { functionTestCases, functions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(functionTestCases)
    .where(eq(functionTestCases.functionId, id));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify function exists
  const [fn] = await db
    .select({ id: functions.id })
    .from(functions)
    .where(eq(functions.id, id));

  if (!fn) {
    return NextResponse.json(
      { error: "Function not found" },
      { status: 404 }
    );
  }

  const body = await req.json();

  const [row] = await db
    .insert(functionTestCases)
    .values({
      functionId: id,
      name: body.name ?? "Untitled",
      input: body.input ?? {},
      expectedOutput: body.expectedOutput ?? null,
      tags: body.tags ?? [],
      showAsExample: body.showAsExample ?? false,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
