import { NextResponse } from "next/server";
import { db } from "@/db";
import { lookupTables, lookupEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  const include = url.searchParams.get("include");

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(lookupTables)
    .where(eq(lookupTables.agentId, agentId))
    .orderBy(lookupTables.createdAt);

  if (include === "entries") {
    const tableIds = rows.map((t) => t.id);
    let allEntries: (typeof lookupEntries.$inferSelect)[] = [];
    if (tableIds.length > 0) {
      allEntries = await db
        .select()
        .from(lookupEntries)
        .orderBy(lookupEntries.order);
    }

    const entriesByTableId = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
      if (!tableIds.includes(entry.tableId)) continue;
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
  const agentId = body.agentId;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .insert(lookupTables)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
