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
import { tools, schemas, modelConfigs } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import {
  createSession,
  saveMessage,
  extractTextContent,
  responseMessagesToUIParts,
} from "@/db/chat-persistence";
import { renderTemplate, gatherTemplateData } from "@/lib/template/render";

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
      and(eq(modelConfigs.agentId, agentId), eq(modelConfigs.isActive, true))
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
    .where(and(eq(tools.agentId, agentId), eq(tools.enabled, true)));

  // Resolve schema references: collect all unique schema IDs referenced by tools
  const schemaIds = new Set<string>();
  for (const row of enabledRows) {
    if (row.parametersSchemaId) schemaIds.add(row.parametersSchemaId);
    if (row.returnParametersSchemaId) schemaIds.add(row.returnParametersSchemaId);
  }

  const schemaMap: Record<
    string,
    import("@/lib/tools/types").ToolParameter[]
  > = {};
  if (schemaIds.size > 0) {
    const schemaRows = await db
      .select()
      .from(schemas)
      .where(inArray(schemas.id, [...schemaIds]));
    for (const s of schemaRows) {
      schemaMap[s.id] = s.parameters;
    }
  }

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
      parameters: row.parametersSchemaId ? (schemaMap[row.parametersSchemaId] ?? []) : [],
      handler: row.handler ?? "",
      executionTarget: row.executionTarget ?? "server",
    }));

  // Gather template data once
  const templateData = await gatherTemplateData(agentId);

  const allTools = toolPayloads.length
    ? buildDynamicTools(toolPayloads, templateData, agentId)
    : {};

  // The last message is the new user message
  const userMessage = messages[messages.length - 1];

  const systemPrompt = await renderTemplate(
    activeConfig.systemPrompt || "",
    templateData,
    hostContext ? { host: hostContext } : undefined
  );

  const result = streamText({
    model: gateway(activeConfig.modelId),
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    temperature: activeConfig.temperature ?? 0.7,
    tools: allTools,
    stopWhen: stepCountIs(5),
    onFinish: ({ response }) => {
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
}
