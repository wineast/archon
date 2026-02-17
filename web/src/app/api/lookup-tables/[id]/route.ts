import { NextResponse } from "next/server";
import { db } from "@/db";
import { lookupTables, lookupEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [table] = await db
    .select()
    .from(lookupTables)
    .where(eq(lookupTables.id, id));

  if (!table) {
    return NextResponse.json(
      { error: "Lookup table not found" },
      { status: 404 }
    );
  }

  const entries = await db
    .select()
    .from(lookupEntries)
    .where(eq(lookupEntries.tableId, id))
    .orderBy(lookupEntries.order);

  return NextResponse.json({ ...table, entries });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(lookupTables)
    .where(eq(lookupTables.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Lookup table not found" },
      { status: 404 }
    );
  }

  const [updated] = await db
    .update(lookupTables)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
    })
    .where(eq(lookupTables.id, id))
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
    .from(lookupTables)
    .where(eq(lookupTables.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Lookup table not found" },
      { status: 404 }
    );
  }

  await db.delete(lookupTables).where(eq(lookupTables.id, id));
  return NextResponse.json({ ok: true });
}
