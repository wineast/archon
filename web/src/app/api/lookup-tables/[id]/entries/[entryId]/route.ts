import { NextResponse } from "next/server";
import { db } from "@/db";
import { lookupEntries, lookupTables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

async function getEntryWithAuth(entryId: string) {
  const [existing] = await db
    .select()
    .from(lookupEntries)
    .where(eq(lookupEntries.id, entryId));

  if (!existing) {
    return { error: NextResponse.json({ error: "Entry not found" }, { status: 404 }) };
  }

  const [table] = await db
    .select()
    .from(lookupTables)
    .where(eq(lookupTables.id, existing.tableId));

  const ctx = await requireAgentRole(table!.agentId!, "editor");
  if (ctx instanceof NextResponse) {
    return { error: ctx };
  }

  return { existing, ctx };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { entryId } = await params;

  const result = await getEntryWithAuth(entryId);
  if ("error" in result) return result.error;

  const body = await req.json();

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

  const result = await getEntryWithAuth(entryId);
  if ("error" in result) return result.error;

  await db.delete(lookupEntries).where(eq(lookupEntries.id, entryId));
  return NextResponse.json({ ok: true });
}
