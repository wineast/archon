import { db } from "@/db";
import { evalRuns, modelConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { CreateEvalRunRequest, CreateEvalRunResponse } from "@/lib/eval/types";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body: CreateEvalRunRequest & { agentId?: string } = await req.json();
  const {
    agentId,
    modelConfigId,
    judgeConfigId,
    judgeConfigName,
    filterTags,
    totalCases,
  } = body;

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Load model config from DB
  const [modelConfig] = await db
    .select()
    .from(modelConfigs)
    .where(and(eq(modelConfigs.id, modelConfigId), isNull(modelConfigs.deletedAt)));

  if (!modelConfig || !modelConfig.modelId) {
    return Response.json(
      { error: "Model config not found or modelId is empty" },
      { status: 400 }
    );
  }

  // Create the run record (stats will be filled in by PATCH /api/eval/run/[runId])
  const [run] = await db
    .insert(evalRuns)
    .values({
      agentId,
      chatModel: modelConfig.modelId,
      chatSystemPrompt: modelConfig.systemPrompt,
      judgeConfigId: judgeConfigId ?? null,
      judgeConfigName,
      filterTags: filterTags ?? [],
      totalCases,
      passedAssertions: 0,
      averageScore: null,
    })
    .returning();

  return Response.json({ runId: run.id } satisfies CreateEvalRunResponse);
}
