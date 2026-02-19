import { generateText, gateway, Output, stepCountIs } from "ai";
import { db } from "@/db";
import { agents as agentsTable, evalRuns, evalRunResults, modelConfigs, tools, schemas } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { runAllAssertions } from "@/lib/eval/assertions";
import { gatherTemplateData, renderTemplate } from "@/lib/template/render";
import { buildJudgeSchema, toJudgeResult } from "@/lib/eval/judge-dimensions";
import type { RunCaseRequest, RunCaseResponse, EvalResult, ChatMessage, TurnResult } from "@/lib/eval/types";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { recordUsage } from "@/lib/usage/record";

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

  // ── Usage accumulators (separate for chat model and judge model) ──
  const chatUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 };
  const judgeUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 };

  const accumulateUsage = (acc: typeof chatUsage, usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; reasoningTokens?: number }) => {
    acc.inputTokens += usage.inputTokens ?? 0;
    acc.outputTokens += usage.outputTokens ?? 0;
    acc.cachedInputTokens += usage.cachedInputTokens ?? 0;
    acc.reasoningTokens += usage.reasoningTokens ?? 0;
  };

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

    // Resolve schema parameters
    const schemaIds = new Set<string>();
    for (const row of enabledRows) {
      if (row.parametersSchemaId) schemaIds.add(row.parametersSchemaId);
    }
    const schemaMap: Record<string, import("@/lib/tools/types").ToolParameter[]> = {};
    if (schemaIds.size > 0) {
      const schemaRows = await db
        .select()
        .from(schemas)
        .where(inArray(schemas.id, [...schemaIds]));
      for (const s of schemaRows) schemaMap[s.id] = s.parameters;
    }

    const toolPayloads: ToolDefinitionPayload[] = enabledRows.map((row) => ({
      name: row.name,
      description: row.description,
      parameters: row.parametersSchemaId ? (schemaMap[row.parametersSchemaId] ?? []) : [],
      handler: row.handler ?? "",
    }));

    const allTools = toolPayloads.length
      ? buildDynamicTools(toolPayloads, templateData, modelConfig.agentId ?? undefined)
      : {};

    const mode = evalCase.mode ?? "single";
    const turns = evalCase.turns ?? [];

    // ── Execute based on mode ──
    const chatMessages: ChatMessage[] = [];
    const turnResults: TurnResult[] = [];
    let chatResponse = "";

    if (mode === "single") {
      // Single turn: one user message, one LLM call
      const userContent = turns[0]?.content ?? "";
      const messages = [{ role: "user" as const, content: userContent }];

      const chatResult = await generateText({
        model: gateway(chatModel),
        system: resolvedSystemPrompt,
        messages,
        temperature: chatTemperature,
        tools: allTools,
        stopWhen: stepCountIs(5),
      });
      chatResponse = chatResult.text;
      accumulateUsage(chatUsage, chatResult.usage);

      chatMessages.push({ role: "user", content: userContent });
      chatMessages.push({ role: "assistant", content: chatResponse });

    } else if (mode === "injected") {
      // Injected: all turns become message history, only last user turn triggers LLM
      const lastUserIndex = turns.reduce(
        (acc, t, i) => (t.role === "user" ? i : acc),
        -1
      );

      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        messages.push({ role: turn.role, content: turn.content });
        chatMessages.push({
          role: turn.role,
          content: turn.content,
          injected: i < lastUserIndex || (i === lastUserIndex ? false : i < turns.length - 1),
        });
      }
      // The last user message is NOT injected
      if (chatMessages.length > 0) {
        chatMessages[chatMessages.length - 1].injected = false;
      }
      // Mark all messages before the last user message as injected
      for (let i = 0; i < chatMessages.length; i++) {
        if (i < lastUserIndex) {
          chatMessages[i].injected = true;
        } else if (i === lastUserIndex) {
          chatMessages[i].injected = false;
        }
      }

      const chatResult = await generateText({
        model: gateway(chatModel),
        system: resolvedSystemPrompt,
        messages,
        temperature: chatTemperature,
        tools: allTools,
        stopWhen: stepCountIs(5),
      });
      chatResponse = chatResult.text;
      accumulateUsage(chatUsage, chatResult.usage);

      chatMessages.push({ role: "assistant", content: chatResponse });

    } else if (mode === "sequential") {
      // Sequential: process turns one at a time, calling LLM for each user turn
      const history: Array<{ role: "user" | "assistant"; content: string }> = [];

      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];

        if (turn.role === "assistant") {
          // Inject assistant turn into history without calling LLM
          history.push({ role: "assistant", content: turn.content });
          chatMessages.push({ role: "assistant", content: turn.content, injected: true });
        } else {
          // User turn: add to history and call LLM
          history.push({ role: "user", content: turn.content });
          chatMessages.push({ role: "user", content: turn.content });

          const chatResult = await generateText({
            model: gateway(chatModel),
            system: resolvedSystemPrompt,
            messages: [...history],
            temperature: chatTemperature,
            tools: allTools,
            stopWhen: stepCountIs(5),
          });
          accumulateUsage(chatUsage, chatResult.usage);
          const assistantResponse = chatResult.text;
          chatResponse = assistantResponse; // Last response

          history.push({ role: "assistant", content: assistantResponse });
          chatMessages.push({ role: "assistant", content: assistantResponse });

          // Per-turn assertions
          let perTurnAssertionsPassed = true;
          if (turn.assertions && turn.assertions.length > 0) {
            const perTurnAssertionResults = runAllAssertions(turn.assertions, assistantResponse);
            perTurnAssertionsPassed = perTurnAssertionResults.every((r) => r.passed);
            turnResults.push({
              turnIndex: i,
              role: "user",
              assertionResults: perTurnAssertionResults,
            });
          }

          // Per-turn judge (skip if per-turn assertions failed)
          if (turn.judge && perTurnAssertionsPassed && dimensions.length > 0) {
            const conversationLog = chatMessages
              .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]: ${m.content}`)
              .join("\n");
            const turnExpected = turn.expectedOutput || evalCase.expectedOutput;
            const judgePrompt = [
              `Conversation:\n${conversationLog}`,
              turnExpected
                ? `Expected Output: ${turnExpected}`
                : null,
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
            accumulateUsage(judgeUsage, judgeGenResult.usage);

            const raw = judgeGenResult.output as Record<string, { score: number; reason: string }>;
            const perTurnJudge = toJudgeResult(raw, dimensions);

            // Find existing turn result or create new one
            const existingIdx = turnResults.findIndex((tr) => tr.turnIndex === i);
            if (existingIdx >= 0) {
              turnResults[existingIdx].judgeResult = perTurnJudge;
            } else {
              turnResults.push({
                turnIndex: i,
                role: "user",
                judgeResult: perTurnJudge,
              });
            }
          }
        }
      }
    }

    // Case-level assertions (on final response)
    const assertionResults = runAllAssertions(evalCase.assertions, chatResponse);
    const allAssertionsPassed = assertionResults.every((r) => r.passed);

    // Case-level judge (only if assertions pass)
    let judgeResult = null;
    if (allAssertionsPassed && dimensions.length > 0) {
      const conversationLog = chatMessages
        .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]: ${m.content}`)
        .join("\n");
      const judgePrompt = [
        mode === "single"
          ? `User Input: ${turns[0]?.content ?? ""}`
          : `Conversation:\n${conversationLog}`,
        evalCase.expectedOutput
          ? `Expected Output: ${evalCase.expectedOutput}`
          : null,
        mode === "single"
          ? `Actual Response: ${chatResponse}`
          : null,
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
      accumulateUsage(judgeUsage, judgeGenResult.usage);

      const raw = judgeGenResult.output as Record<string, { score: number; reason: string }>;
      judgeResult = toJudgeResult(raw, dimensions);
    }

    result = {
      caseId: evalCase.id,
      caseName: evalCase.name,
      mode,
      turns,
      chatMessages,
      turnResults,
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
      mode: evalCase.mode ?? "single",
      turns: evalCase.turns ?? [],
      chatMessages: [],
      turnResults: [],
      chatResponse: "",
      assertionResults: [],
      allAssertionsPassed: false,
      judgeResult: null,
      timestamp: Date.now(),
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Fetch orgId from agent for usage recording
  let evalOrgId: string | null = null;
  if (run.agentId) {
    const [agentInfo] = await db
      .select({ orgId: agentsTable.orgId })
      .from(agentsTable)
      .where(eq(agentsTable.id, run.agentId))
      .limit(1);
    evalOrgId = agentInfo?.orgId ?? null;
  }

  // Record usage (chat model + judge model separately)
  if (chatUsage.inputTokens > 0 || chatUsage.outputTokens > 0) {
    await recordUsage({
      orgId: evalOrgId,
      agentId: run.agentId,
      userId: ctx.user.id,
      sessionId: null,
      modelId: chatModel,
      usage: chatUsage,
      source: "eval",
    });
  }
  if (judgeUsage.inputTokens > 0 || judgeUsage.outputTokens > 0) {
    await recordUsage({
      orgId: evalOrgId,
      agentId: run.agentId,
      userId: ctx.user.id,
      sessionId: null,
      modelId: judgeConfig.model,
      usage: judgeUsage,
      source: "eval",
    });
  }

  // Save result to DB
  await db.insert(evalRunResults).values({
    runId,
    caseId: result.caseId,
    caseName: result.caseName,
    mode: result.mode,
    turns: result.turns,
    chatMessages: result.chatMessages,
    turnResults: result.turnResults,
    chatResponse: result.chatResponse || null,
    assertionResults: result.assertionResults,
    allAssertionsPassed: result.allAssertionsPassed,
    judgeResult: result.judgeResult,
    error: result.error ?? null,
    durationMs: result.durationMs,
  });

  return Response.json({ result } satisfies RunCaseResponse);
}
