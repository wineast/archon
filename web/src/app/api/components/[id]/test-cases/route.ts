import { NextResponse } from "next/server";
import { db } from "@/db";
import { componentTestCases, components } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(componentTestCases)
    .where(eq(componentTestCases.componentId, id));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify component exists
  const [comp] = await db
    .select({ id: components.id })
    .from(components)
    .where(eq(components.id, id));

  if (!comp) {
    return NextResponse.json(
      { error: "Component not found" },
      { status: 404 }
    );
  }

  const body = await req.json();

  const [row] = await db
    .insert(componentTestCases)
    .values({
      componentId: id,
      name: body.name ?? "Untitled",
      data: body.data ?? {},
      tags: body.tags ?? [],
      ...(body.showAsExample !== undefined && { showAsExample: body.showAsExample }),
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
