import { NextResponse } from "next/server";
import { db } from "@/db";
import { functions } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(functions)
    .orderBy(asc(functions.key));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(functions)
    .values({
      agentId: body.agentId ?? null,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      code: body.code,
      parameters: body.parameters ?? [],
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
