import { db } from "@/db";
import { evalRuns, modelConfigs, judgeConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { CreateEvalRunRequest, CreateEvalRunResponse } from "@/lib/eval/types";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  const body: CreateEvalRunRequest = await req.json();
  const {
    agentId,
    judgeAgentId,
    filterTags,
    assertionFailConfig,
    concurrency: rawConcurrency,
    totalCases,
    cases,
    templateVars = {},
    toolNames = [],
  } = body;

  const concurrency = Math.max(1, Math.min(5, rawConcurrency ?? 3));

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (!cases || cases.length === 0) {
    return NextResponse.json({ error: "cases are required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Concurrency check: no other running run for this agent
  const [existingRunning] = await db
    .select({ id: evalRuns.id })
    .from(evalRuns)
    .where(
      and(
        eq(evalRuns.agentId, agentId),
        eq(evalRuns.status, "running"),
      )
    )
    .limit(1);

  if (existingRunning) {
    return NextResponse.json(
      { error: "An eval run is already in progress for this agent" },
      { status: 409 }
    );
  }

  // Resolve active model config for the agent
  const versionId = await resolveEditingVersionId(agentId);
  const [modelConfig] = await db
    .select()
    .from(modelConfigs)
    .where(
      and(
        eq(modelConfigs.versionId, versionId),
        eq(modelConfigs.isActive, true),
        isNull(modelConfigs.deletedAt),
      )
    );

  if (!modelConfig || !modelConfig.modelId) {
    return Response.json(
      { error: "No active model config found for this agent" },
      { status: 400 }
    );
  }

  // Resolve active model config for the judge agent
  const judgeVersionId = await resolveEditingVersionId(judgeAgentId);
  const [judgeModelConfig] = await db
    .select()
    .from(modelConfigs)
    .where(
      and(
        eq(modelConfigs.versionId, judgeVersionId),
        eq(modelConfigs.isActive, true),
        isNull(modelConfigs.deletedAt),
      )
    );

  if (!judgeModelConfig || !judgeModelConfig.modelId) {
    return Response.json(
      { error: "No active model config found for the judge agent" },
      { status: 400 }
    );
  }

  // Resolve active judge config
  const [judgeConfig] = await db
    .select()
    .from(judgeConfigs)
    .where(
      and(
        eq(judgeConfigs.versionId, judgeVersionId),
        eq(judgeConfigs.isActive, true),
        isNull(judgeConfigs.deletedAt),
      )
    );

  if (!judgeConfig) {
    return Response.json(
      { error: "No active judge config found for the judge agent" },
      { status: 400 }
    );
  }

  // Create the run record with snapshots — status: "running"
  const [run] = await db
    .insert(evalRuns)
    .values({
      agentId,
      chatModel: modelConfig.modelId,
      chatSystemPrompt: modelConfig.systemPrompt,
      chatTemperature: modelConfig.temperature,
      judgeAgentId,
      judgeModelConfigSnapshot: {
        modelId: judgeModelConfig.modelId,
        systemPrompt: judgeModelConfig.systemPrompt,
        temperature: judgeModelConfig.temperature,
      },
      judgeConfigSnapshot: {
        name: judgeConfig.name,
        dimensions: judgeConfig.dimensions,
      },
      filterTags: filterTags ?? [],
      assertionFailConfig: assertionFailConfig ?? null,
      templateVars,
      toolNames,
      concurrency,
      totalCases,
      passedAssertions: 0,
      averageScore: null,
      status: "running",
      completedCases: 0,
    })
    .returning();

  // Send Inngest event to start orchestration
  await inngest.send({
    name: "eval/run.created",
    data: {
      runId: run.id,
      agentId,
      caseIds: cases.map((c) => c.id),
      userId: ctx.user.id,
    },
  });

  return Response.json({
    runId: run.id,
    chatModel: run.chatModel,
    status: run.status,
  } satisfies CreateEvalRunResponse);
}
