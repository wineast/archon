import { db } from "@/db";
import { evalBatches, evalRuns, modelConfigs, judgeConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { CreateEvalBatchRequest, CreateEvalBatchResponse } from "@/lib/eval/types";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  const body: CreateEvalBatchRequest = await req.json();
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
    repeatCount: rawRepeatCount,
    runConcurrency: rawRunConcurrency,
  } = body;

  const concurrency = Math.max(1, Math.min(5, rawConcurrency ?? 3));
  const repeatCount = Math.max(1, Math.min(10, rawRepeatCount ?? 1));
  const runConcurrency = Math.max(1, Math.min(5, rawRunConcurrency ?? 1));

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (!cases || cases.length === 0) {
    return NextResponse.json({ error: "cases are required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Concurrency check: no other running batch for this agent
  const [existingRunning] = await db
    .select({ id: evalBatches.id })
    .from(evalBatches)
    .where(
      and(
        eq(evalBatches.agentId, agentId),
        eq(evalBatches.status, "running"),
      )
    )
    .limit(1);

  if (existingRunning) {
    return NextResponse.json(
      { error: "An eval batch is already in progress for this agent" },
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

  // Create batch record
  const [batch] = await db
    .insert(evalBatches)
    .values({
      agentId,
      repeatCount,
      runConcurrency,
      chatModel: modelConfig.modelId,
      judgeConfigSnapshot: {
        name: judgeConfig.name,
        dimensions: judgeConfig.dimensions,
      },
      totalCasesPerRun: totalCases,
      status: "running",
      completedRuns: 0,
      totalRuns: repeatCount,
    })
    .returning();

  // Create N eval run records
  const runConfigs: Array<{ runId: string; caseIds: string[] }> = [];
  const caseIds = cases.map((c) => c.id);

  for (let i = 0; i < repeatCount; i++) {
    const [run] = await db
      .insert(evalRuns)
      .values({
        agentId,
        batchId: batch.id,
        runIndex: i,
        chatVersionId: versionId,
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
        status: "pending",
        completedCases: 0,
      })
      .returning();

    runConfigs.push({ runId: run.id, caseIds });
  }

  // Send Inngest event
  await inngest.send({
    name: "eval/batch.created",
    data: {
      batchId: batch.id,
      agentId,
      runConfigs,
      userId: ctx.user.id,
    },
  });

  return Response.json({
    batchId: batch.id,
    chatModel: batch.chatModel,
    status: batch.status,
  } satisfies CreateEvalBatchResponse);
}
