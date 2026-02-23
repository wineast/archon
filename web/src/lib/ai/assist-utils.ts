import {
  streamText,
  tool,
  UIMessage,
  convertToModelMessages,
} from "ai";
import { z } from "zod";
import { after, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-agent-role";
import { recordUsage, type UsageSource } from "@/lib/usage/record";
import { recordRuntimeEvents } from "@/lib/runtime-events/record";
import type { RuntimeEventInput } from "@/lib/runtime-events/record";
import {
  createSession,
  saveMessage,
  extractTextContent,
  responseMessagesToUIParts,
} from "@/db/chat-persistence";
import { resolveModel } from "@/lib/ai/resolve-model";
import { getOrgIdByAgentId } from "@/lib/ai/get-org-id";
import { resolveAgentSlot } from "@/lib/slots";
import { QuotaExceededError } from "@/lib/credits/errors";
import { gatherTemplateData, renderTemplate, disposeTemplateData } from "@/lib/template/render";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Build the standard update/edit tool pair used by all AI assist routes.
 *
 * @param entity - Short noun used in tool names and descriptions (e.g. "prompt", "code", "content")
 */
export function buildAssistTools(entity: string) {
  return {
    [`update_${entity}`]: tool({
      description: `整体替换编辑器中的${entity}。适用于大范围重写。`,
      inputSchema: z.object({
        content: z.string().describe(`完整的更新后${entity}内容`),
      }),
    }),
    [`edit_${entity}`]: tool({
      description: `局部编辑${entity}。在当前内容中找到 old_text 并替换为 new_text。`,
      inputSchema: z.object({
        old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
        new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
      }),
    }),
  };
}

export interface AssistConfig {
  source: UsageSource;
  /** Parse the request body and return messages, optional agentId, sessionId, and context for the assist template. */
  buildParams: (body: Record<string, unknown>) => Promise<{
    messages: UIMessage[];
    agentId?: string;
    sessionId?: string;
    fieldContext: string;
    currentContent: string;
    entity: string;
  }>;
}

/**
 * Load the active system prompt for a given agent.
 */
async function loadAssistSystemPrompt(agentId: string): Promise<string> {
  const [config] = await db
    .select({ systemPrompt: modelConfigs.systemPrompt })
    .from(modelConfigs)
    .where(and(eq(modelConfigs.agentId, agentId), eq(modelConfigs.isActive, true)))
    .limit(1);

  return config?.systemPrompt ?? "";
}

/**
 * Factory that creates a Next.js POST handler for AI assist routes.
 *
 * Shared logic:
 * - Authentication (requireAuth)
 * - Model resolution (resolveModel + quota check)
 * - System prompt loading from assist agent DB + LiquidJS template rendering
 * - streamText() call
 * - Non-blocking usage recording via after()
 */
export function createAssistHandler(config: AssistConfig) {
  return async function POST(req: Request): Promise<Response> {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { messages, agentId, sessionId, fieldContext, currentContent, entity } =
      await config.buildParams(body);

    const currentUserId = authResult.id;
    const orgId = await getOrgIdByAgentId(agentId);
    const assistConfig = agentId
      ? await resolveAgentSlot(agentId, "assist")
      : null;

    if (assistConfig && !assistConfig.agentId) {
      return Response.json(
        { error: "slot_not_configured", message: "Assist Agent 未配置" },
        { status: 422 },
      );
    }

    const modelId = assistConfig?.model ?? "anthropic/claude-sonnet-4";

    let model;
    try {
      model = await resolveModel(modelId, orgId);
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        return Response.json(
          { error: "quota_exceeded", message: e.message },
          { status: 402 },
        );
      }
      throw e;
    }

    // Load system prompt from assist agent's model config and render through LiquidJS
    const assistAgentId = assistConfig?.agentId;
    let system = "";
    if (assistAgentId) {
      const rawPrompt = await loadAssistSystemPrompt(assistAgentId);
      if (rawPrompt) {
        const versionId = await resolveEditingVersionId(assistAgentId);
        const templateData = await gatherTemplateData(assistAgentId, versionId);
        try {
          system = await renderTemplate(rawPrompt, templateData, {
            fieldContext,
            currentContent,
            entity,
          });
        } finally {
          disposeTemplateData(templateData);
        }
      }
    }

    const tools = buildAssistTools(entity);

    const streamStartTime = performance.now();
    const userMessage = messages[messages.length - 1];

    // ── Eager persist: session + user message (before streaming) ──
    if (sessionId && userMessage) {
      try {
        if (messages.length === 1) {
          const title =
            extractTextContent(userMessage.parts as unknown[]).slice(0, 100) ||
            config.source;
          await createSession({
            id: sessionId,
            title,
            model: modelId,
            systemPrompt: system,
            agentId,
            userId: currentUserId,
          });
        }
        await saveMessage({
          id: crypto.randomUUID(),
          sessionId,
          role: userMessage.role as "user" | "assistant" | "system",
          parts: userMessage.parts as unknown[],
        });
      } catch (e) {
        console.error(`[${config.source}] failed to eagerly save session/user message:`, e);
      }
    }

    const result = streamText({
      model,
      messages: await convertToModelMessages(messages),
      onFinish: ({ totalUsage, response, steps }) => {
        // Usage recording
        after(async () => {
          await recordUsage({
            orgId,
            agentId: agentId ?? null,
            userId: currentUserId,
            sessionId: sessionId ?? null,
            modelId,
            usage: {
              inputTokens: totalUsage.inputTokens,
              outputTokens: totalUsage.outputTokens,
              cachedInputTokens: totalUsage.cachedInputTokens,
              reasoningTokens: totalUsage.reasoningTokens,
            },
            source: config.source,
          });
        });

        // Runtime events
        const toolCallCount = steps.reduce(
          (sum, step) => sum + (step.toolCalls?.length ?? 0),
          0
        );
        const events: RuntimeEventInput[] = [
          {
            agentId: agentId ?? "unknown",
            sessionId: sessionId ?? null,
            eventType: "llm_call",
            severity: "info",
            durationMs: Math.round(performance.now() - streamStartTime),
            metadata: {
              modelId,
              inputTokens: totalUsage.inputTokens,
              outputTokens: totalUsage.outputTokens,
              toolCallCount,
              stepCount: steps.length,
              source: config.source,
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
            console.error(`[${config.source}] failed to save assistant message:`, e);
          }
        });
      },
      system,
      tools,
    });

    return result.toUIMessageStreamResponse();
  };
}
