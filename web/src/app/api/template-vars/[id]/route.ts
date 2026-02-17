import { NextResponse } from "next/server";
import { db } from "@/db";
import { templateVars } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(templateVars)
    .where(eq(templateVars.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(templateVars)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.value !== undefined && { value: body.value }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.isArray !== undefined && { isArray: body.isArray }),
    })
    .where(eq(templateVars.id, id))
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
    .from(templateVars)
    .where(eq(templateVars.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(templateVars).where(eq(templateVars.id, id));
  return NextResponse.json({ ok: true });
}
