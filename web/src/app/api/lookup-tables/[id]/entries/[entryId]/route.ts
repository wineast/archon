import { NextResponse } from "next/server";
import { db } from "@/db";
import { lookupEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { entryId } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(lookupEntries)
    .where(eq(lookupEntries.id, entryId));

  if (!existing) {
    return NextResponse.json(
      { error: "Entry not found" },
      { status: 404 }
    );
  }

  const [updated] = await db
    .update(lookupEntries)
    .set({
      ...(body.value !== undefined && { value: body.value }),
      ...(body.label !== undefined && { label: body.label }),
      ...(body.metadata !== undefined && { metadata: body.metadata }),
      ...(body.order !== undefined && { order: body.order }),
    })
    .where(eq(lookupEntries.id, entryId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { entryId } = await params;

  const [existing] = await db
    .select()
    .from(lookupEntries)
    .where(eq(lookupEntries.id, entryId));

  if (!existing) {
    return NextResponse.json(
      { error: "Entry not found" },
      { status: 404 }
    );
  }

  await db.delete(lookupEntries).where(eq(lookupEntries.id, entryId));
  return NextResponse.json({ ok: true });
}
