import { db } from "@/db";
import { evalBatches, evalRuns, modelConfigs, judgeConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import type {
  CreateEvalRunRequest,
  CreateEvalRunResponse,
} from "@/lib/eval/types";
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

  const judgeEnabled = !!judgeAgentId;
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
      and(eq(evalBatches.agentId, agentId), eq(evalBatches.status, "running")),
    )
    .limit(1);

  if (existingRunningBatch) {
    return NextResponse.json(
      { error: "An eval batch is already in progress for this agent" },
      { status: 409 },
    );
  }

  // Snapshot config + create run in a single transaction for read consistency
  let run: typeof evalRuns.$inferSelect;
  try {
    run = await db.transaction(
      async (tx) => {
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
            ),
          );

        if (!modelConfig || !modelConfig.modelId) {
          throw new ConfigError("No active model config found for this agent");
        }

        let judgeVersionId: string | null = null;
        let judgeModelConfig: {
          modelId: string;
          systemPrompt: string;
          temperature: number;
        } | null = null;
        let judgeConfig: {
          name: string;
          dimensions: unknown;
          promptTemplate: string | null;
          turnPromptTemplate: string | null;
        } | null = null;

        if (judgeEnabled) {
          // Resolve active model config for the judge agent
          judgeVersionId = await resolveEditingVersionId(judgeAgentId!, tx);
          const [judgeModelConfigRow] = await tx
            .select()
            .from(modelConfigs)
            .where(
              and(
                eq(modelConfigs.versionId, judgeVersionId),
                eq(modelConfigs.isActive, true),
                isNull(modelConfigs.deletedAt),
              ),
            );

          if (!judgeModelConfigRow || !judgeModelConfigRow.modelId) {
            throw new ConfigError(
              "No active model config found for the judge agent",
            );
          }

          judgeModelConfig = {
            modelId: judgeModelConfigRow.modelId,
            systemPrompt: judgeModelConfigRow.systemPrompt,
            temperature: judgeModelConfigRow.temperature,
          };

          // Resolve active judge config
          const [judgeConfigRow] = await tx
            .select()
            .from(judgeConfigs)
            .where(
              and(
                eq(judgeConfigs.versionId, judgeVersionId),
                eq(judgeConfigs.isActive, true),
                isNull(judgeConfigs.deletedAt),
              ),
            );

          if (!judgeConfigRow) {
            throw new ConfigError(
              "No active judge config found for the judge agent",
            );
          }

          judgeConfig = {
            name: judgeConfigRow.name,
            dimensions: judgeConfigRow.dimensions,
            promptTemplate: judgeConfigRow.promptTemplate,
            turnPromptTemplate: judgeConfigRow.turnPromptTemplate,
          };
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
            judgeAgentId: judgeEnabled ? judgeAgentId : null,
            judgeVersionId: judgeEnabled ? judgeVersionId : null,
            judgeModelConfigSnapshot: judgeEnabled
              ? {
                  modelId: judgeModelConfig!.modelId,
                  systemPrompt: judgeModelConfig!.systemPrompt,
                  temperature: judgeModelConfig!.temperature,
                }
              : null,
            judgeConfigSnapshot: judgeEnabled
              ? {
                  name: judgeConfig!.name,
                  dimensions: judgeConfig!.dimensions,
                  promptTemplate: judgeConfig!.promptTemplate,
                  turnPromptTemplate: judgeConfig!.turnPromptTemplate,
                }
              : null,
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
      },
      { isolationLevel: "repeatable read" },
    );
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
