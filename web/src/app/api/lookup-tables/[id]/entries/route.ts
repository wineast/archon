import { NextResponse } from "next/server";
import { db } from "@/db";
import { lookupTables, lookupEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

async function getTableWithAuth(tableId: string, minRole: "viewer" | "editor") {
  const [table] = await db
    .select()
    .from(lookupTables)
    .where(eq(lookupTables.id, tableId));

  if (!table) {
    return { error: NextResponse.json({ error: "Lookup table not found" }, { status: 404 }) };
  }

  const ctx = await requireAgentRole(table.agentId!, minRole);
  if (ctx instanceof NextResponse) {
    return { error: ctx };
  }

  return { table, ctx };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await getTableWithAuth(id, "viewer");
  if ("error" in result) return result.error;

  const entries = await db
    .select()
    .from(lookupEntries)
    .where(eq(lookupEntries.tableId, id))
    .orderBy(lookupEntries.order);

  return NextResponse.json(entries);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await getTableWithAuth(id, "editor");
  if ("error" in result) return result.error;

  const body = await req.json();

  const [row] = await db
    .insert(lookupEntries)
    .values({
      tableId: id,
      value: body.value,
      label: body.label ?? null,
      metadata: body.metadata ?? null,
      order: body.order ?? 0,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await getTableWithAuth(id, "editor");
  if ("error" in result) return result.error;

  const body: Array<{
    value: string;
    label?: string;
    metadata?: Record<string, unknown>;
    order?: number;
  }> = await req.json();

  // Delete existing entries and replace
  await db.delete(lookupEntries).where(eq(lookupEntries.tableId, id));

  if (body.length > 0) {
    await db.insert(lookupEntries).values(
      body.map((entry, i) => ({
        tableId: id,
        value: entry.value,
        label: entry.label ?? null,
        metadata: entry.metadata ?? null,
        order: entry.order ?? i,
      }))
    );
  }

  const entries = await db
    .select()
    .from(lookupEntries)
    .where(eq(lookupEntries.tableId, id))
    .orderBy(lookupEntries.order);

  return NextResponse.json(entries);
}
