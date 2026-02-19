import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalJudgeConfigs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
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
    .from(evalJudgeConfigs)
    .where(and(eq(evalJudgeConfigs.agentId, agentId), isNull(evalJudgeConfigs.deletedAt)))
    .orderBy(evalJudgeConfigs.createdAt);
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
    .insert(evalJudgeConfigs)
    .values({
      agentId,
      key: body.key,
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
