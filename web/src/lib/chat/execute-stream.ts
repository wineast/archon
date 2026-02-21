import {
  streamText,
  gateway,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { after } from "next/server";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import { db } from "@/db";
import { agents, tools, modelConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import {
  createSession,
  saveMessage,
  extractTextContent,
  responseMessagesToUIParts,
} from "@/db/chat-persistence";
import { renderTemplate, gatherTemplateData } from "@/lib/template/render";
import { recordUsage } from "@/lib/usage/record";
import type { RuntimeEventInput } from "@/lib/runtime-events/record";
import { recordRuntimeEvents } from "@/lib/runtime-events/record";

export interface ExecuteChatStreamOptions {
  messages: UIMessage[];
  sessionId?: string;
  agentId: string;
  /** DB user id. null for anonymous embed users. */
  userId: string | null;
  /** Host page context injected via ArchonEmbed.setContext(). */
  hostContext?: Record<string, unknown>;
  /** Tool names registered by the host page via ArchonEmbed.registerTools(). */
  registeredHostTools?: string[];
}

/**
 * Shared chat stream logic used by both /api/chat and /api/embed/chat.
 * Returns a Response (stream or error JSON).
 */
export async function executeChatStream(
  opts: ExecuteChatStreamOptions
): Promise<Response> {
  const { messages, sessionId, agentId, userId, hostContext, registeredHostTools } = opts;

  // Get agent's orgId for usage recording
  const [agentRow] = await db
    .select({ orgId: agents.orgId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  const orgId = agentRow?.orgId ?? null;

  // Validate hostContext size (10KB limit)
  if (hostContext) {
    const contextSize = new TextEncoder().encode(JSON.stringify(hostContext)).length;
    if (contextSize > 10240) {
      return new Response(
        JSON.stringify({ error: "hostContext exceeds 10KB limit" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Read active model config from DB (scoped to agent)
  const [activeConfig] = await db
    .select()
    .from(modelConfigs)
    .where(
      and(eq(modelConfigs.agentId, agentId), eq(modelConfigs.isActive, true), isNull(modelConfigs.deletedAt))
    )
    .limit(1);

  if (!activeConfig?.modelId) {
    return new Response(
      JSON.stringify({ error: "No active model config or modelId is empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Read all enabled tools from DB (scoped to agent)
  const enabledRows = await db
    .select()
    .from(tools)
    .where(and(eq(tools.agentId, agentId), eq(tools.enabled, true), isNull(tools.deletedAt)));

  // Gather template data once (includes resolved schemas and defsMap)
  const templateData = await gatherTemplateData(agentId);

  // Use resolved schema parameters from templateData.schemaMap
  const toolPayloads: ToolDefinitionPayload[] = enabledRows
    .filter((row) => {
      // Exclude host tools that are not registered by the host page
      if (row.executionTarget === "host") {
        return registeredHostTools?.includes(row.name) ?? false;
      }
      return true;
    })
    .map((row) => ({
      name: row.name,
      description: row.description,
      parameters: row.parametersSchemaId ? (templateData.schemaMap[row.parametersSchemaId] ?? { type: "object", properties: {}, required: [] }) : { type: "object", properties: {}, required: [] },
      returnParameters: row.returnParametersSchemaId
        ? (templateData.schemaMap[row.returnParametersSchemaId] ?? undefined)
        : undefined,
      handler: row.handler ?? "",
      url: row.url ?? "",
      executionTarget: row.executionTarget ?? "server",
      sandboxMode: row.sandboxMode ?? "light",
    }));

  // Runtime event collector
  const eventCollector: RuntimeEventInput[] = [];
  const streamStartTime = performance.now();

  const allTools = toolPayloads.length
    ? buildDynamicTools(toolPayloads, templateData, agentId, eventCollector)
    : {};

  // The last message is the new user message
  const userMessage = messages[messages.length - 1];

  const systemPrompt = await renderTemplate(
    activeConfig.systemPrompt || "",
    templateData,
    hostContext ? { host: hostContext } : undefined
  );

  try {
    const result = streamText({
      model: gateway(activeConfig.modelId),
      messages: await convertToModelMessages(messages),
      system: systemPrompt,
      temperature: activeConfig.temperature ?? 0.7,
      tools: allTools,
      stopWhen: stepCountIs(5),
      onFinish: ({ response, totalUsage, steps }) => {
        // Record usage (independent of session persistence)
        after(async () => {
          await recordUsage({
            orgId,
            agentId,
            userId,
            sessionId: sessionId ?? null,
            modelId: activeConfig.modelId,
            usage: {
              inputTokens: totalUsage.inputTokens,
              outputTokens: totalUsage.outputTokens,
              cachedInputTokens: totalUsage.cachedInputTokens,
              reasoningTokens: totalUsage.reasoningTokens,
            },
            source: userId ? "chat" : "embed",
          });
        });

        // Collect llm_call event
        const toolCallCount = steps.reduce(
          (sum, step) => sum + (step.toolCalls?.length ?? 0),
          0
        );
        eventCollector.push({
          agentId,
          eventType: "llm_call",
          severity: "info",
          durationMs: Math.round(performance.now() - streamStartTime),
          metadata: {
            modelId: activeConfig.modelId,
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            toolCallCount,
            stepCount: steps.length,
          },
        });

        // Flush runtime events
        after(async () => {
          // Back-fill sessionId into all events
          for (const evt of eventCollector) {
            evt.sessionId = sessionId ?? null;
          }
          await recordRuntimeEvents(eventCollector);
        });

        if (!sessionId || !userMessage) return;
        after(async () => {
          try {
            // 1. Ensure session exists
            if (messages.length === 1) {
              const title =
                extractTextContent(userMessage.parts as unknown[]).slice(
                  0,
                  100
                ) || "New Chat";
              await createSession({
                id: sessionId,
                title,
                model: activeConfig.modelId,
                systemPrompt: activeConfig.systemPrompt,
                agentId,
                userId: userId ?? undefined,
              });
            }
            // 2. Save user message
            await saveMessage({
              id: crypto.randomUUID(),
              sessionId,
              role: userMessage.role as "user" | "assistant" | "system",
              parts: userMessage.parts as unknown[],
            });
            // 3. Save assistant response
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
            console.error("[chat] failed to save messages:", e);
          }
        });
      },
    });

    const response = result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });

    if (sessionId) {
      response.headers.set("X-Session-Id", sessionId);
    }

    return response;
  } catch (e) {
    // Capture stream initialization errors
    const errorMsg = e instanceof Error ? e.message : String(e);
    eventCollector.push({
      agentId,
      sessionId: sessionId ?? null,
      eventType: "stream_error",
      severity: "error",
      durationMs: Math.round(performance.now() - streamStartTime),
      metadata: { error: errorMsg.slice(0, 500) },
    });
    // Best-effort flush
    recordRuntimeEvents(eventCollector).catch(() => {});
    throw e;
  }
}
