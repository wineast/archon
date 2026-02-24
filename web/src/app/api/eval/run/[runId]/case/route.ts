import { generateText, Output, stepCountIs } from "ai";
import { db } from "@/db";
import { evalRuns, evalRunResults, tools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { runAllAssertions } from "@/lib/eval/assertions";
import { gatherTemplateData, renderTemplate, disposeTemplateData } from "@/lib/template/render";
import { buildJudgeSchema, toJudgeResult } from "@/lib/eval/judge-dimensions";
import type { RunCaseRequest, RunCaseResponse, EvalResult, ChatMessage, TurnResult, Dimension } from "@/lib/eval/types";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { EMPTY_OBJECT_SCHEMA } from "@/lib/schemas/types";
import { resolveInlineSchema } from "@/lib/schemas/resolve-inline";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { recordUsage } from "@/lib/usage/record";
import { resolveModel } from "@/lib/ai/resolve-model";
import { getOrgIdByAgentId } from "@/lib/ai/get-org-id";
import { QuotaExceededError } from "@/lib/credits/errors";

export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const body: RunCaseRequest = await req.json();
  const {
    case: evalCase,
    templateVars = {},
    toolNames = [],
  } = body;

  // Verify run exists
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));

  if (!run || !run.agentId) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(run.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const orgId = await getOrgIdByAgentId(run.agentId);

  // Read all config from the run record (snapshot)
  const chatModel = run.chatModel;
  const chatSystemPrompt = run.chatSystemPrompt;
  const chatTemperature = run.chatTemperature;

  const judgeSnapshot = run.judgeModelConfigSnapshot as { modelId: string; systemPrompt: string; temperature: number } | null;
  const judgeModel = judgeSnapshot?.modelId ?? "";
  const judgeSystemPrompt = judgeSnapshot?.systemPrompt ?? "";
  const judgeTemperature = judgeSnapshot?.temperature ?? 0.1;

  const judgeConfigSnapshot = run.judgeConfigSnapshot as { name: string; dimensions: Dimension[] } | null;
  const dimensions: Dimension[] = judgeConfigSnapshot?.dimensions ?? [];
  const judgeSchema = buildJudgeSchema(dimensions);

  const evalAgentId = run.agentId ?? undefined;
  const evalVersionId = evalAgentId ? await resolveEditingVersionId(evalAgentId) : undefined;
  const templateData = await gatherTemplateData(evalAgentId, evalVersionId);

  try {
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
    const enabledRows = evalVersionId
      ? await db
          .select()
          .from(tools)
          .where(and(eq(tools.versionId, evalVersionId), eq(tools.enabled, true), isNull(tools.deletedAt)))
      : [];

    const toolPayloads: ToolDefinitionPayload[] = enabledRows.map((row) => ({
      name: row.name,
      description: row.description,
      parameters: resolveInlineSchema(row.parametersSchema ?? null, templateData.defsMap) ?? EMPTY_OBJECT_SCHEMA,
      handler: row.handler ?? "",
      url: row.url ?? "",
      sandboxMode: row.sandboxMode ?? "light",
    }));

    const allTools = toolPayloads.length
      ? buildDynamicTools(toolPayloads, templateData, evalAgentId, undefined, evalVersionId)
      : {};

    const mode = evalCase.mode ?? "single";
    const turns = evalCase.turns ?? [];
    const { judgeOnFail = false, judgeTurnOnFail = false, stopOnTurnFail = false } = run.assertionFailConfig ?? {};

    // ── Execute based on mode ──
    const chatMessages: ChatMessage[] = [];
    const turnResults: TurnResult[] = [];
    let chatResponse = "";

    if (mode === "single") {
      // Single turn: one user message, one LLM call
      const userContent = turns[0]?.content ?? "";
      const messages = [{ role: "user" as const, content: userContent }];

      const chatResult = await generateText({
        model: await resolveModel(chatModel, orgId),
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
          injected: i < lastUserIndex,
        });
      }

      const chatResult = await generateText({
        model: await resolveModel(chatModel, orgId),
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
            model: await resolveModel(chatModel, orgId),
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

          // Stop subsequent turns if configured
          if (!perTurnAssertionsPassed && stopOnTurnFail) break;

          // Per-turn judge (skip if per-turn assertions failed, unless configured otherwise)
          if (turn.judge && (perTurnAssertionsPassed || judgeTurnOnFail) && dimensions.length > 0) {
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
              model: await resolveModel(judgeModel, orgId),
              system: await renderTemplate(
                judgeSystemPrompt,
                templateData,
                { ...templateVars, model: chatModel, caseName: evalCase.name, toolNames }
              ),
              prompt: judgePrompt,
              temperature: judgeTemperature,
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

    // Case-level judge (only if assertions pass, unless configured otherwise)
    let judgeResult = null;
    if ((allAssertionsPassed || judgeOnFail) && dimensions.length > 0) {
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
        model: await resolveModel(judgeModel, orgId),
        system: await renderTemplate(
          judgeSystemPrompt,
          templateData,
          { ...templateVars, model: chatModel, caseName: evalCase.name, toolNames }
        ),
        prompt: judgePrompt,
        temperature: judgeTemperature,
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
    if (err instanceof QuotaExceededError) {
      return Response.json({ error: "quota_exceeded", message: err.message }, { status: 402 });
    }
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

  // Record usage (chat model + judge model separately)
  if (chatUsage.inputTokens > 0 || chatUsage.outputTokens > 0) {
    await recordUsage({
      orgId,
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
      orgId,
      agentId: run.agentId,
      userId: ctx.user.id,
      sessionId: null,
      modelId: judgeModel,
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
  } finally {
    disposeTemplateData(templateData);
  }
}
