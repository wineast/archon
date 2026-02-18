import {
  streamText,
  gateway,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { after, NextResponse } from "next/server";
import { buildDynamicTools } from "./tools/build-dynamic-tools";
import { db } from "@/db";
import { tools, modelConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { resolveEnumRefs } from "@/lib/tools/resolve-enum-refs";
import {
  createSession,
  saveMessage,
  extractTextContent,
  responseMessagesToUIParts,
} from "@/db/chat-persistence";
import { renderTemplate, gatherTemplateData } from "@/lib/template/render";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

// Side-effect: all implementations self-register into the registry
import "@/tool-impls";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    sessionId,
    agentId,
  }: {
    messages: UIMessage[];
    sessionId?: string;
    agentId?: string;
  } = await req.json();

  // Auth: require viewer access to the agent
  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "agentId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const userId = ctx.user.id;

  // Read active model config from DB (scoped to agent)
  const [activeConfig] = await db
    .select()
    .from(modelConfigs)
    .where(and(eq(modelConfigs.agentId, agentId), eq(modelConfigs.isActive, true)))
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

  const toolPayloads: ToolDefinitionPayload[] = enabledRows.map((row) => ({
    name: row.name,
    description: row.description,
    parameters: row.parameters,
    output: row.output ?? "",
    handler: row.handler ?? "",
  }));

  // Resolve enumRef → enum for all parameters
  const allParams = toolPayloads.flatMap((t) => t.parameters);
  await resolveEnumRefs(allParams);

  // Gather template data once for both system prompt and tool output rendering
  const templateData = await gatherTemplateData(agentId);

  const allTools = toolPayloads.length
    ? buildDynamicTools(toolPayloads, templateData, agentId)
    : {};

  // The last message is always the new user message
  const userMessage = messages[messages.length - 1];

  const systemPrompt = await renderTemplate(
    activeConfig.systemPrompt || "",
    templateData
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
      // Save all messages in a single after() to guarantee order
      after(async () => {
        try {
          // 1. Ensure session exists
          if (messages.length === 1) {
            const title =
              extractTextContent(userMessage.parts as unknown[]).slice(0, 100) ||
              "New Chat";
            await createSession({
              id: sessionId,
              title,
              model: activeConfig.modelId,
              systemPrompt: activeConfig.systemPrompt,
              agentId,
              userId,
            });
          }
          // 2. Save user message first
          await saveMessage({
            id: crypto.randomUUID(),
            sessionId,
            role: userMessage.role as "user" | "assistant" | "system",
            parts: userMessage.parts as unknown[],
          });
          // 3. Convert model messages to UI format and save as single assistant message
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
