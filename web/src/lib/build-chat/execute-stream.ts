import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { after } from "next/server";
import { gatherResourceSummary } from "./resource-summary";
import { buildSystemPrompt } from "./system-prompt";
import { buildAllTools } from "./tools";
import { getOrgBuildChatSettings } from "@/lib/orgs/build-chat-settings";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveModel } from "@/lib/ai/resolve-model";
import { QuotaExceededError } from "@/lib/credits/errors";
import { recordUsage } from "@/lib/usage/record";
import { recordRuntimeEvents } from "@/lib/runtime-events/record";
import type { RuntimeEventInput } from "@/lib/runtime-events/record";
import {
  createSession,
  saveMessage,
  extractTextContent,
  responseMessagesToUIParts,
} from "@/db/chat-persistence";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_TEMPERATURE = 0.3;

export interface ExecuteBuildChatStreamOptions {
  messages: UIMessage[];
  agentId: string;
  sessionId?: string;
  userId: string;
}

/**
 * Stream logic for the Build Chat assistant.
 * Uses org-configured model & temperature, with server-side tools to operate on agent resources.
 * No message persistence — operations are persisted to resource tables.
 */
export async function executeBuildChatStream(
  opts: ExecuteBuildChatStreamOptions
): Promise<Response> {
  const { messages, agentId, sessionId, userId } = opts;

  const [summary, [agentRow]] = await Promise.all([
    gatherResourceSummary(agentId),
    db.select({ skillsEnabled: agents.skillsEnabled, orgId: agents.orgId }).from(agents).where(eq(agents.id, agentId)).limit(1),
  ]);
  const skillsEnabled = agentRow?.skillsEnabled !== false;
  const orgId = agentRow?.orgId ?? null;

  const settings = orgId
    ? await getOrgBuildChatSettings(orgId)
    : { buildChatModel: DEFAULT_MODEL, buildChatTemperature: DEFAULT_TEMPERATURE };

  const systemPrompt = buildSystemPrompt(summary);
  const allTools = buildAllTools(agentId, { skillsEnabled });

  let model;
  try {
    model = await resolveModel(settings.buildChatModel, orgId);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: "quota_exceeded", message: e.message }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
    throw e;
  }

  const streamStartTime = performance.now();
  const userMessage = messages[messages.length - 1];

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    temperature: settings.buildChatTemperature,
    tools: allTools,
    stopWhen: stepCountIs(10),
    onFinish: ({ totalUsage, response, steps }) => {
      // Usage recording
      after(async () => {
        await recordUsage({
          orgId,
          agentId,
          userId,
          sessionId: sessionId ?? null,
          modelId: settings.buildChatModel,
          usage: {
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            cachedInputTokens: totalUsage.cachedInputTokens,
            reasoningTokens: totalUsage.reasoningTokens,
          },
          source: "build-chat",
        });
      });

      // Runtime events
      const toolCallCount = steps.reduce(
        (sum, step) => sum + (step.toolCalls?.length ?? 0),
        0
      );
      const events: RuntimeEventInput[] = [
        {
          agentId,
          sessionId: sessionId ?? null,
          eventType: "llm_call",
          severity: "info",
          durationMs: Math.round(performance.now() - streamStartTime),
          metadata: {
            modelId: settings.buildChatModel,
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            toolCallCount,
            stepCount: steps.length,
          },
        },
      ];
      after(async () => {
        await recordRuntimeEvents(events);
      });

      // Session persistence
      if (!sessionId || !userMessage) return;
      after(async () => {
        try {
          if (messages.length === 1) {
            const title =
              extractTextContent(userMessage.parts as unknown[]).slice(0, 100) ||
              "Build Chat";
            await createSession({
              id: sessionId,
              title,
              model: settings.buildChatModel,
              systemPrompt,
              agentId,
              userId,
            });
          }
          await saveMessage({
            id: crypto.randomUUID(),
            sessionId,
            role: userMessage.role as "user" | "assistant" | "system",
            parts: userMessage.parts as unknown[],
          });
          const uiParts = responseMessagesToUIParts(response.messages);
          if (uiParts.length > 0) {
            await saveMessage({
              id: crypto.randomUUID(),
              sessionId,
              role: "assistant",
              parts: uiParts,
            });
          }
        } catch (e) {
          console.error("[build-chat] failed to save messages:", e);
        }
      });
    },
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
  });
}
