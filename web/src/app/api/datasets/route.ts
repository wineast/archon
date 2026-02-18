import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(datasets)
    .orderBy(asc(datasets.key));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(datasets)
    .values({
      agentId: body.agentId ?? null,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      layer: body.layer ?? 0,
      data: body.data,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
