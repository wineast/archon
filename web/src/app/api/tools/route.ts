import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(tools).orderBy(tools.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(tools)
    .values({
      name: body.name,
      description: body.description,
      parameters: body.parameters ?? [],
      output: body.output ?? null,
      handler: body.handler ?? null,
      component: body.component ?? null,
      componentSource: body.componentSource ?? null,
      componentMockData: body.componentMockData ?? null,
      enabled: body.enabled ?? true,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
