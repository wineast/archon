import { NextResponse } from "next/server";
import { db } from "@/db";
import { dataObjects } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select()
    .from(dataObjects)
    .orderBy(dataObjects.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(dataObjects)
    .values({
      agentId: body.agentId ?? null,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      data: body.data ?? {},
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
