import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";

interface ReorderUpdate {
  id: string;
  order: number;
}

export async function POST(req: Request) {
  const body = await req.json();
  const updates: ReorderUpdate[] = body.updates;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  await Promise.all(
    updates.map((u) =>
      db.update(wikiDocuments).set({ order: u.order }).where(eq(wikiDocuments.id, u.id))
    )
  );

  return NextResponse.json({ ok: true });
}
