import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.agentId, agentId))
    .orderBy(modelConfigs.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const agentId = body.agentId;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .insert(modelConfigs)
    .values({
      agentId,
      name: body.name,
      modelId: body.modelId ?? "",
      systemPrompt: body.systemPrompt ?? "",
      temperature: body.temperature ?? 0.7,
      isActive: false,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
