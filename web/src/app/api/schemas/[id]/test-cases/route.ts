import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemaTestCases, schemas } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(schemaTestCases)
    .where(eq(schemaTestCases.schemaId, id));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify schema exists
  const [schema] = await db
    .select({ id: schemas.id })
    .from(schemas)
    .where(eq(schemas.id, id));

  if (!schema) {
    return NextResponse.json(
      { error: "Schema not found" },
      { status: 404 }
    );
  }

  const body = await req.json();

  const [row] = await db
    .insert(schemaTestCases)
    .values({
      schemaId: id,
      name: body.name ?? "Untitled",
      input: body.input ?? {},
      shouldPass: body.shouldPass ?? true,
      expectedErrors: body.expectedErrors ?? null,
      tags: body.tags ?? [],
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
