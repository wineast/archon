import { generateText, Output, stepCountIs } from "ai";
import type { ModelMessage, AssistantModelMessage, ToolModelMessage } from "@ai-sdk/provider-utils";
import type { TextPart, ToolCallPart, ToolResultPart } from "@ai-sdk/provider-utils";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { runAllAssertions } from "@/lib/eval/assertions";
import { gatherTemplateData, renderTemplate, disposeTemplateData } from "@/lib/template/render";
import { buildJudgeSchema, toJudgeResult } from "@/lib/eval/judge-dimensions";
import type { EvalResult, ChatMessage, TurnResult, Dimension, EvalTurn, EvalCase, ToolCallRecord } from "@/lib/eval/types";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { EMPTY_OBJECT_SCHEMA } from "@/lib/schemas/types";
import { resolveInlineSchema } from "@/lib/schemas/resolve-inline";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { resolveModel } from "@/lib/ai/resolve-model";
import type { EvalRunRow } from "@/db/schema";
import type { AssertionFailConfig } from "@/lib/eval/types";

// ── Helper: extract ToolCallRecord[] from generateText steps ──

export function extractToolCalls(steps: Awaited<ReturnType<typeof generateText>>["steps"] | undefined): ToolCallRecord[] {
  if (!steps) return [];
  const records: ToolCallRecord[] = [];
  for (const step of steps) {
    for (const tc of step.toolCalls) {
      const matchingResult = step.toolResults.find(
        (tr) => tr.toolCallId === tc.toolCallId
      );
      records.push({
        toolName: tc.toolName,
        args: (tc.input ?? {}) as Record<string, unknown>,
        result: matchingResult?.output,
      });
    }
  }
  return records;
}

// ── Helper: convert EvalTurn (with optional toolCalls) to ModelMessage[] ──

export function turnToMessages(turn: EvalTurn): ModelMessage[] {
  if (turn.role === "user") {
    return [{ role: "user", content: turn.content }];
  }

  // assistant turn without toolCalls
  if (!turn.toolCalls || turn.toolCalls.length === 0) {
    return [{ role: "assistant", content: turn.content }];
  }

  // assistant turn with toolCalls → AssistantModelMessage + ToolModelMessage
  const assistantParts: (TextPart | ToolCallPart)[] = [];
  if (turn.content) {
    assistantParts.push({ type: "text", text: turn.content });
  }
  for (const tc of turn.toolCalls) {
    assistantParts.push({
      type: "tool-call",
      toolCallId: `eval-tc-${tc.name}`,
      toolName: tc.name,
      input: tc.args,
    });
  }

  const toolResultParts: ToolResultPart[] = turn.toolCalls.map((tc) => ({
    type: "tool-result" as const,
    toolCallId: `eval-tc-${tc.name}`,
    toolName: tc.name,
    output: { type: "text" as const, value: tc.result },
  }));

  const assistantMsg: AssistantModelMessage = { role: "assistant", content: assistantParts };
  const toolMsg: ToolModelMessage = { role: "tool", content: toolResultParts };

  return [assistantMsg, toolMsg];
}

// ── Usage accumulator type ──

export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
}

function createUsageData(): UsageData {
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 };
}

function accumulateUsage(acc: UsageData, usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; reasoningTokens?: number }) {
  acc.inputTokens += usage.inputTokens ?? 0;
  acc.outputTokens += usage.outputTokens ?? 0;
  acc.cachedInputTokens += usage.cachedInputTokens ?? 0;
  acc.reasoningTokens += usage.reasoningTokens ?? 0;
}

// ── Main execute case function ──

export interface ExecuteCaseParams {
  run: EvalRunRow;
  evalCase: EvalCase;
  templateVars: Record<string, string>;
  toolNames: string[];
  orgId: string;
}

export interface ExecuteCaseReturn {
  result: EvalResult;
  chatUsage: UsageData;
  judgeUsage: UsageData;
}

export async function executeCase(params: ExecuteCaseParams): Promise<ExecuteCaseReturn> {
  const { run, evalCase, templateVars, toolNames, orgId } = params;

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

  const chatUsage = createUsageData();
  const judgeUsage = createUsageData();

  try {
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
      const { judgeOnFail = false, judgeTurnOnFail = false, stopOnTurnFail = false } = (run.assertionFailConfig as AssertionFailConfig | null) ?? {};

      // ── Execute based on mode ──
      const chatMessages: ChatMessage[] = [];
      const turnResults: TurnResult[] = [];
      let chatResponse = "";
      let allToolCalls: ToolCallRecord[] = [];

      if (mode === "single") {
        const userContent = turns[0]?.content ?? "";
        const messages: ModelMessage[] = [{ role: "user", content: userContent }];

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

        allToolCalls = extractToolCalls(chatResult.steps);

        chatMessages.push({ role: "user", content: userContent });
        chatMessages.push({
          role: "assistant",
          content: chatResponse,
          toolCalls: allToolCalls.length > 0
            ? allToolCalls.map((tc) => ({ name: tc.toolName, args: tc.args }))
            : undefined,
        });

      } else if (mode === "injected") {
        const lastUserIndex = turns.reduce(
          (acc, t, i) => (t.role === "user" ? i : acc),
          -1
        );

        const messages: ModelMessage[] = [];

        for (let i = 0; i < turns.length; i++) {
          const turn = turns[i];
          const turnMsgs = turnToMessages(turn);
          messages.push(...turnMsgs);
          chatMessages.push({
            role: turn.role,
            content: turn.content,
            injected: i < lastUserIndex || (i === lastUserIndex ? false : i < turns.length - 1),
            toolCalls: turn.toolCalls?.map((tc) => ({ name: tc.name, args: tc.args })),
          });
        }
        for (let i = 0; i < chatMessages.length; i++) {
          if (i < lastUserIndex) {
            chatMessages[i].injected = true;
          } else if (i === lastUserIndex) {
            chatMessages[i].injected = false;
          }
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

        allToolCalls = extractToolCalls(chatResult.steps);

        chatMessages.push({
          role: "assistant",
          content: chatResponse,
          toolCalls: allToolCalls.length > 0
            ? allToolCalls.map((tc) => ({ name: tc.toolName, args: tc.args }))
            : undefined,
        });

      } else if (mode === "sequential") {
        const history: ModelMessage[] = [];

        for (let i = 0; i < turns.length; i++) {
          const turn = turns[i];

          if (turn.role === "assistant") {
            const turnMsgs = turnToMessages(turn);
            history.push(...turnMsgs);
            chatMessages.push({
              role: "assistant",
              content: turn.content,
              injected: true,
              toolCalls: turn.toolCalls?.map((tc) => ({ name: tc.name, args: tc.args })),
            });
          } else {
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
            chatResponse = assistantResponse;

            const turnToolCalls = extractToolCalls(chatResult.steps);
            allToolCalls.push(...turnToolCalls);

            history.push({ role: "assistant", content: assistantResponse });
            chatMessages.push({
              role: "assistant",
              content: assistantResponse,
              toolCalls: turnToolCalls.length > 0
                ? turnToolCalls.map((tc) => ({ name: tc.toolName, args: tc.args }))
                : undefined,
            });

            // Per-turn assertions
            let perTurnAssertionsPassed = true;
            if (turn.assertions && turn.assertions.length > 0) {
              const perTurnAssertionResults = runAllAssertions(turn.assertions, assistantResponse, turnToolCalls);
              perTurnAssertionsPassed = perTurnAssertionResults.every((r) => r.passed);
              turnResults.push({
                turnIndex: i,
                role: "user",
                assertionResults: perTurnAssertionResults,
              });
            }

            if (!perTurnAssertionsPassed && stopOnTurnFail) break;

            // Per-turn judge (skip if no expected output to evaluate against)
            const turnExpected = turn.expectedOutput || evalCase.expectedOutput;
            if (turn.judge && (perTurnAssertionsPassed || judgeTurnOnFail) && dimensions.length > 0 && turnExpected) {
              const conversationLog = chatMessages
                .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]: ${m.content}`)
                .join("\n");
              const judgePrompt = [
                `Conversation:\n${conversationLog}`,
                turnExpected ? `Expected Output: ${turnExpected}` : null,
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

      // Case-level assertions
      const assertionResults = runAllAssertions(evalCase.assertions, chatResponse, allToolCalls);
      const allAssertionsPassed = assertionResults.every((r) => r.passed);

      // Case-level judge (skip if no expected output to evaluate against)
      let judgeResult = null;
      if ((allAssertionsPassed || judgeOnFail) && dimensions.length > 0 && evalCase.expectedOutput) {
        const conversationLog = chatMessages
          .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]: ${m.content}`)
          .join("\n");
        const mode_ = evalCase.mode ?? "single";
        const judgePrompt = [
          mode_ === "single"
            ? `User Input: ${turns[0]?.content ?? ""}`
            : `Conversation:\n${conversationLog}`,
          evalCase.expectedOutput
            ? `Expected Output: ${evalCase.expectedOutput}`
            : null,
          mode_ === "single"
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
        mode: evalCase.mode ?? "single",
        turns: evalCase.turns ?? [],
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

    return { result, chatUsage, judgeUsage };
  } finally {
    disposeTemplateData(templateData);
  }
}
