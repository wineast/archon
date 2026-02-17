import { db } from "@/db";
import { evalRuns, modelConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { CreateEvalRunRequest, CreateEvalRunResponse } from "@/lib/eval/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body: CreateEvalRunRequest = await req.json();
  const {
    modelConfigId,
    judgeConfigId,
    judgeConfigName,
    filterTags,
    totalCases,
  } = body;

  // Load model config from DB
  const [modelConfig] = await db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.id, modelConfigId));

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
