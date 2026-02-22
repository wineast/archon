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
import { resolveSlot } from "@/lib/slots";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { db } from "@/db";
import { agents, tools as toolsTable, agentResourceRefs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
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

export interface ExecuteBuildChatStreamOptions {
  messages: UIMessage[];
  agentId: string;
  sessionId?: string;
  userId: string;
}

/**
 * Stream logic for the Build Chat assistant.
 * Uses org-configured model & temperature, with server-side tools to operate on agent resources.
 * System tools are filtered by DB enabled state.
 */
export async function executeBuildChatStream(
  opts: ExecuteBuildChatStreamOptions
): Promise<Response> {
  const { messages, agentId, sessionId, userId } = opts;

  const versionId = await resolveEditingVersionId(agentId);
  const [summary, [agentRow]] = await Promise.all([
    gatherResourceSummary(agentId, versionId),
    db.select({ skillsEnabled: agents.skillsEnabled, orgId: agents.orgId }).from(agents).where(eq(agents.id, agentId)).limit(1),
  ]);
  const skillsEnabled = agentRow?.skillsEnabled !== false;
  const orgId = agentRow?.orgId ?? null;

  // Get model config via slot resolution
  const config = await resolveSlot(agentId, "builder");

  const systemPrompt = buildSystemPrompt(summary);
  const codeTools = buildAllTools(agentId, { skillsEnabled });

  // Filter tools by DB enabled state: check pool refs for builtin tools
  let filteredTools = codeTools;
  if (config.agentId) {
    // Query builtin pool tools referenced by this build-chat agent
    const dbTools = await db
      .select({ key: toolsTable.key, enabled: agentResourceRefs.enabled })
      .from(agentResourceRefs)
      .innerJoin(toolsTable, eq(toolsTable.id, agentResourceRefs.resourceId))
      .where(
        and(
          eq(agentResourceRefs.agentId, config.agentId),
          eq(agentResourceRefs.resourceType, "tool"),
          eq(toolsTable.origin, "builtin"),
          isNull(toolsTable.agentId),
        )
      );

    if (dbTools.length > 0) {
      const enabledKeys = new Set(dbTools.filter((t) => t.enabled).map((t) => t.key));
      filteredTools = Object.fromEntries(
        Object.entries(codeTools).filter(([key]) => enabledKeys.has(key))
      );
    }
  }

  let model;
  try {
    model = await resolveModel(config.model, orgId);
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

  // ── Eager persist: session + user message (before streaming) ──
  if (sessionId && userMessage) {
    try {
      if (messages.length === 1) {
        const title =
          extractTextContent(userMessage.parts as unknown[]).slice(0, 100) ||
          "Build Chat";
        await createSession({
          id: sessionId,
          title,
          model: config.model,
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
    } catch (e) {
      console.error("[build-chat] failed to eagerly save session/user message:", e);
    }
  }

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    temperature: config.temperature,
    tools: filteredTools,
    stopWhen: stepCountIs(10),
    onFinish: ({ totalUsage, response, steps }) => {
      // Usage recording
      after(async () => {
        await recordUsage({
          orgId,
          agentId,
          userId,
          sessionId: sessionId ?? null,
          modelId: config.model,
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
            modelId: config.model,
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

      // Save assistant response (session + user message already persisted before streaming)
      if (!sessionId || !userMessage) return;
      after(async () => {
        try {
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
          console.error("[build-chat] failed to save assistant message:", e);
        }
      });
    },
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
  });
}
