import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { validateNoCycle } from "@/lib/datasets/queries";

export async function GET() {
  const rows = await db
    .select()
    .from(datasets)
    .orderBy(asc(datasets.key));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const newRow = {
    agentId: body.agentId ?? null,
    key: body.key,
    name: body.name,
    description: body.description ?? "",
    data: body.data,
  };

  // Validate no circular dependency
  if (newRow.agentId) {
    const existing = await db
      .select({ key: datasets.key, data: datasets.data })
      .from(datasets)
      .where(eq(datasets.agentId, newRow.agentId));
    try {
      validateNoCycle([...existing, { key: newRow.key, data: newRow.data }]);
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }
  }

  const [row] = await db
    .insert(datasets)
    .values(newRow)
    .returning();

  return NextResponse.json(row, { status: 201 });
}
