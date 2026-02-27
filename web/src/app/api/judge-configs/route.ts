import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { judgeConfigs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { DEFAULT_PROMPT_TEMPLATE, DEFAULT_TURN_PROMPT_TEMPLATE } from "@/lib/eval/judge-prompt";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(judgeConfigs)
    .where(and(eq(judgeConfigs.agentId, agentId), isNull(judgeConfigs.deletedAt)))
    .orderBy(judgeConfigs.createdAt);
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

  const versionId = await resolveEditingVersionId(agentId);

  const [row] = await db
    .insert(judgeConfigs)
    .values({
      agentId,
      versionId,
      key: body.key,
      name: body.name,
      isActive: false,
      dimensions: body.dimensions ?? [],
      promptTemplate: body.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE,
      turnPromptTemplate: body.turnPromptTemplate ?? DEFAULT_TURN_PROMPT_TEMPLATE,
    })
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "judge_config",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(row, { status: 201 });
}
