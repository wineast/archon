import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalCases } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(evalCases).orderBy(evalCases.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(evalCases)
    .values({
      name: body.name,
      input: body.input,
      expectedOutput: body.expectedOutput ?? null,
      assertions: body.assertions ?? [],
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
