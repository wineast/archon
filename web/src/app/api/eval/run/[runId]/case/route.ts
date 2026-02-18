import { generateText, gateway, Output, stepCountIs } from "ai";
import { db } from "@/db";
import { evalRuns, evalRunResults, modelConfigs, tools } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { runAllAssertions } from "@/lib/eval/assertions";
import { gatherTemplateData, renderTemplate } from "@/lib/template/render";
import { buildJudgeSchema, toJudgeResult } from "@/lib/eval/judge-dimensions";
import type { RunCaseRequest, RunCaseResponse, EvalResult } from "@/lib/eval/types";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const body: RunCaseRequest = await req.json();
  const {
    case: evalCase,
    judgeConfig,
    modelConfigId,
    templateVars = {},
    toolNames = [],
  } = body;

  // Verify run exists
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(run.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

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

  const chatModel = modelConfig.modelId;
  const chatSystemPrompt = modelConfig.systemPrompt;
  const chatTemperature = modelConfig.temperature;

  const dimensions = judgeConfig.dimensions ?? [];
  const judgeSchema = buildJudgeSchema(dimensions);
  const templateData = await gatherTemplateData(modelConfig.agentId ?? undefined);

  const start = Date.now();
  let result: EvalResult;

  try {
    // Resolve template variables in system prompt
    const resolvedSystemPrompt = await renderTemplate(
      chatSystemPrompt,
      templateData,
      { ...templateVars, model: chatModel, caseName: evalCase.name, toolNames }
    );

    // Build tools (matching chat route)
    const enabledRows = await db
      .select()
      .from(tools)
      .where(eq(tools.enabled, true));

    const toolPayloads: ToolDefinitionPayload[] = enabledRows.map((row) => ({
      name: row.name,
      description: row.description,
      parameters: row.parameters,
      handler: row.handler ?? "",
    }));

    const allTools = toolPayloads.length
      ? buildDynamicTools(toolPayloads, templateData, modelConfig.agentId ?? undefined)
      : {};

    // 1. Generate chat response
    const chatResult = await generateText({
      model: gateway(chatModel),
      system: resolvedSystemPrompt,
      prompt: evalCase.input,
      temperature: chatTemperature,
      tools: allTools,
      stopWhen: stepCountIs(5),
    });
    const chatResponse = chatResult.text;

    // 2. Run assertions
    const assertionResults = runAllAssertions(evalCase.assertions, chatResponse);
    const allAssertionsPassed = assertionResults.every((r) => r.passed);

    // 3. Judge (only if assertions pass)
    let judgeResult = null;
    if (allAssertionsPassed) {
      const judgePrompt = [
        `User Input: ${evalCase.input}`,
        evalCase.expectedOutput
          ? `Expected Output: ${evalCase.expectedOutput}`
          : null,
        `Actual Response: ${chatResponse}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const judgeGenResult = await generateText({
        model: gateway(judgeConfig.model),
        system: await renderTemplate(
          judgeConfig.systemPrompt,
          templateData,
          { ...templateVars, model: chatModel, caseName: evalCase.name, toolNames }
        ),
        prompt: judgePrompt,
        temperature: judgeConfig.temperature ?? 0.1,
        output: Output.object({ schema: judgeSchema }),
      });

      const raw = judgeGenResult.output as Record<string, { score: number; reason: string }>;
      judgeResult = toJudgeResult(raw, dimensions);
    }

    result = {
      caseId: evalCase.id,
      caseName: evalCase.name,
      input: evalCase.input,
      chatResponse,
      assertionResults,
      allAssertionsPassed,
      judgeResult,
      timestamp: Date.now(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    result = {
      caseId: evalCase.id,
      caseName: evalCase.name,
      input: evalCase.input,
      chatResponse: "",
      assertionResults: [],
      allAssertionsPassed: false,
      judgeResult: null,
      timestamp: Date.now(),
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Save result to DB
  await db.insert(evalRunResults).values({
    runId,
    caseId: result.caseId,
    caseName: result.caseName,
    input: result.input,
    chatResponse: result.chatResponse || null,
    assertionResults: result.assertionResults,
    allAssertionsPassed: result.allAssertionsPassed,
    judgeResult: result.judgeResult,
    error: result.error ?? null,
    durationMs: result.durationMs,
  });

  return Response.json({ result } satisfies RunCaseResponse);
}
