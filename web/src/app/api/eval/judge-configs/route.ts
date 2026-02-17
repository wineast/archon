import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalJudgeConfigs } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select()
    .from(evalJudgeConfigs)
    .orderBy(evalJudgeConfigs.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(evalJudgeConfigs)
    .values({
      name: body.name,
      model: body.model,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature ?? 0.1,
      dimensions: body.dimensions ?? [],
      isDefault: body.isDefault ?? false,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
