import { NextResponse } from "next/server";
import { db } from "@/db";
import { templateVars } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(templateVars)
    .orderBy(asc(templateVars.key));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(templateVars)
    .values({
      agentId: body.agentId ?? null,
      key: body.key ?? "",
      value: body.value ?? "",
      type: body.type ?? "text",
      isArray: body.isArray ?? false,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
