import { db } from "@/db";
import { evalBatches, evalRuns, modelConfigs, judgeConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { CreateEvalRunRequest, CreateEvalRunResponse } from "@/lib/eval/types";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { inngest } from "@/inngest/client";

class ConfigError extends Error {}

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

  // Concurrency check: no other running batch for this agent
  const [existingRunningBatch] = await db
    .select({ id: evalBatches.id })
    .from(evalBatches)
    .where(
      and(
        eq(evalBatches.agentId, agentId),
        eq(evalBatches.status, "running"),
      )
    )
    .limit(1);

  if (existingRunningBatch) {
    return NextResponse.json(
      { error: "An eval batch is already in progress for this agent" },
      { status: 409 }
    );
  }

  // Snapshot config + create run in a single transaction for read consistency
  let run: typeof evalRuns.$inferSelect;
  try {
  run = await db.transaction(async (tx) => {
    // Resolve active model config for the agent
    const versionId = await resolveEditingVersionId(agentId, tx);
    const [modelConfig] = await tx
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
      throw new ConfigError("No active model config found for this agent");
    }

    // Resolve active model config for the judge agent
    const judgeVersionId = await resolveEditingVersionId(judgeAgentId, tx);
    const [judgeModelConfig] = await tx
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
      throw new ConfigError("No active model config found for the judge agent");
    }

    // Resolve active judge config
    const [judgeConfig] = await tx
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
      throw new ConfigError("No active judge config found for the judge agent");
    }

    // Create the run record with snapshots — status: "running"
    const [row] = await tx
      .insert(evalRuns)
      .values({
        agentId,
        chatVersionId: versionId,
        chatModel: modelConfig.modelId,
        chatSystemPrompt: modelConfig.systemPrompt,
        chatTemperature: modelConfig.temperature,
        judgeAgentId,
        judgeVersionId,
        judgeModelConfigSnapshot: {
          modelId: judgeModelConfig.modelId,
          systemPrompt: judgeModelConfig.systemPrompt,
          temperature: judgeModelConfig.temperature,
        },
        judgeConfigSnapshot: {
          name: judgeConfig.name,
          dimensions: judgeConfig.dimensions,
          promptTemplate: judgeConfig.promptTemplate,
          turnPromptTemplate: judgeConfig.turnPromptTemplate,
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

    return row;
  }, { isolationLevel: "repeatable read" });
  } catch (e) {
    if (e instanceof ConfigError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

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
