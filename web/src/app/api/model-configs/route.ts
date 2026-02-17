import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select()
    .from(modelConfigs)
    .orderBy(modelConfigs.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [row] = await db
    .insert(modelConfigs)
    .values({
      name: body.name,
      modelId: body.modelId ?? "",
      systemPrompt: body.systemPrompt ?? "",
      temperature: body.temperature ?? 0.7,
      isActive: false,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
