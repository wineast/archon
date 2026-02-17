import { NextResponse } from "next/server";
import { db } from "@/db";
import { lookupTables, lookupEntries } from "@/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const include = url.searchParams.get("include");

  const rows = await db
    .select()
    .from(lookupTables)
    .orderBy(lookupTables.createdAt);

  if (include === "entries") {
    const allEntries = await db
      .select()
      .from(lookupEntries)
      .orderBy(lookupEntries.order);

    const entriesByTableId = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
      const arr = entriesByTableId.get(entry.tableId) ?? [];
      arr.push(entry);
      entriesByTableId.set(entry.tableId, arr);
    }

    const result = rows.map((t) => ({
      ...t,
      entries: entriesByTableId.get(t.id) ?? [],
    }));
    return NextResponse.json(result);
  }

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(lookupTables)
    .values({
      agentId: body.agentId ?? null,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
