import {
  streamText,
  tool,
  type Tool,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { after } from "next/server";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import { createMCPClient } from "@ai-sdk/mcp";
import { db } from "@/db";
import { agents, tools, modelConfigs, mcpServers, skills } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { retrieveMemories } from "@/lib/memory/retrieve";
import { formatMemoriesForInjection } from "@/lib/memory/format-for-injection";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import {
  createSession,
  saveMessage,
  extractTextContent,
  responseMessagesToUIParts,
} from "@/db/chat-persistence";
import { renderTemplate, gatherTemplateData } from "@/lib/template/render";
import { resolveInlineSchema } from "@/lib/schemas/resolve-inline";
import { recordUsage } from "@/lib/usage/record";
import type { RuntimeEventInput } from "@/lib/runtime-events/record";
import { recordRuntimeEvents } from "@/lib/runtime-events/record";
import { extractMemories, serialiseConversation } from "@/lib/memory/extract";
import { resolveModel } from "@/lib/ai/resolve-model";
import { QuotaExceededError } from "@/lib/credits/errors";

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

  // Get agent's orgId, mcpEnabled, skillsEnabled, and memoryEnabled
  const [agentRow] = await db
    .select({ orgId: agents.orgId, mcpEnabled: agents.mcpEnabled, skillsEnabled: agents.skillsEnabled, memoryEnabled: agents.memoryEnabled })
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
      parameters: resolveInlineSchema(row.parametersSchema ?? null, templateData.defsMap) ?? { type: "object", properties: {}, required: [] },
      returnParameters: resolveInlineSchema(row.returnParametersSchema ?? null, templateData.defsMap) ?? undefined,
      handler: row.handler ?? "",
      url: row.url ?? "",
      executionTarget: row.executionTarget ?? "server",
      sandboxMode: row.sandboxMode ?? "light",
    }));

  // Runtime event collector
  const eventCollector: RuntimeEventInput[] = [];
  const streamStartTime = performance.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools: Record<string, any> = toolPayloads.length
    ? buildDynamicTools(toolPayloads, templateData, agentId, eventCollector)
    : {};

  // Connect to enabled MCP servers and merge their tools (skip if agent.mcpEnabled is false)
  const mcpClients: Awaited<ReturnType<typeof createMCPClient>>[] = [];
  const enabledMcpServers = agentRow?.mcpEnabled !== false
    ? await db
        .select()
        .from(mcpServers)
        .where(and(eq(mcpServers.agentId, agentId), eq(mcpServers.enabled, true), isNull(mcpServers.deletedAt)))
    : [];

  if (enabledMcpServers.length > 0) {
    const results = await Promise.allSettled(
      enabledMcpServers.map(async (server) => {
        if (!server.url) throw new Error("URL not configured");
        const client = await createMCPClient({
          transport: {
            type: server.transportType as "sse" | "http",
            url: server.url,
            headers: server.headers && Object.keys(server.headers).length > 0
              ? server.headers
              : undefined,
          },
        });
        return { server, client };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { server, client } = result.value;
        mcpClients.push(client);
        try {
          const mcpTools = await client.tools();
          for (const [toolName, toolDef] of Object.entries(mcpTools)) {
            const prefixedName = `mcp_${server.key}__${toolName}`;
            allTools[prefixedName] = toolDef;
          }
        } catch (e) {
          eventCollector.push({
            agentId,
            eventType: "mcp_connect_error",
            severity: "warning",
            metadata: { serverKey: server.key, serverId: server.id, error: e instanceof Error ? e.message : String(e), phase: "tools" },
          });
        }
      } else {
        const server = enabledMcpServers[results.indexOf(result)];
        eventCollector.push({
          agentId,
          eventType: "mcp_connect_error",
          severity: "warning",
          metadata: { serverKey: server.key, serverId: server.id, error: result.reason?.message ?? String(result.reason), phase: "connect" },
        });
      }
    }
  }

  // The last message is the new user message
  const userMessage = messages[messages.length - 1];

  // ── Memory injection ──
  let memoryBlock = "";
  let memoryInjectionMode: "system_prompt" | "context" | "none" = "none";

  if (agentRow?.memoryEnabled) {
    const retrieved = await retrieveMemories({ agentId, userId, sessionId });
    if (retrieved && retrieved.items.length > 0) {
      memoryInjectionMode = retrieved.config.injectionMode;
      memoryBlock = formatMemoriesForInjection(retrieved.items);
    }
  }


  let systemPrompt = await renderTemplate(
    activeConfig.systemPrompt || "",
    templateData,
    hostContext ? { host: hostContext } : undefined
  );

  // ── Memory: append to system prompt ──
  if (memoryBlock && memoryInjectionMode === "system_prompt") {
    systemPrompt = systemPrompt + "\n\n" + memoryBlock;
  }

  // Load enabled skills and inject summary + get_skill_detail tool (skip if skills feature is disabled)
  const enabledSkills = agentRow?.skillsEnabled !== false
    ? await db
        .select()
        .from(skills)
        .where(and(eq(skills.agentId, agentId), eq(skills.enabled, true), isNull(skills.deletedAt)))
        .orderBy(asc(skills.order), asc(skills.key))
    : [];

  if (enabledSkills.length > 0) {
    const skillSummaryLines = enabledSkills.map(
      (s) => `- ${s.name} (key: ${s.key}): ${s.description}`
    );
    systemPrompt +=
      `\n\n## 可用技能\n当用户请求与某个技能相关时，必须先调用 get_skill_detail 获取完整指引，再严格按照指引执行。不要凭自身知识猜测，技能内容是唯一执行依据。\n` +
      skillSummaryLines.join("\n");

    allTools.get_skill_detail = tool({
      description: "获取技能的完整执行指引。当用户请求匹配某个技能时，必须先调用此工具获取指引再执行，不要跳过。",
      inputSchema: z.object({ skill_key: z.string().describe("技能的 key") }),
      execute: async ({ skill_key }: { skill_key: string }) => {
        const matched = enabledSkills.find((s) => s.key === skill_key);
        if (!matched) {
          return { error: `技能 ${skill_key} 不存在或未启用` };
        }
        const renderedContent = await renderTemplate(
          matched.content,
          templateData,
          hostContext ? { host: hostContext } : undefined
        );
        return { name: matched.name, content: renderedContent };
      },
    });
  }

  try {
    const modelMessages = await convertToModelMessages(messages);

    // Inject memories as an extra system message when mode is "context"
    if (memoryBlock && memoryInjectionMode === "context") {
      modelMessages.unshift({ role: "system", content: memoryBlock });
    }

    const result = streamText({
      model: await resolveModel(activeConfig.modelId, orgId),
      messages: modelMessages,
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

        // Flush runtime events + close MCP clients
        after(async () => {
          // Back-fill sessionId into all events
          for (const evt of eventCollector) {
            evt.sessionId = sessionId ?? null;
          }
          await recordRuntimeEvents(eventCollector);
          // Close all MCP clients
          await Promise.allSettled(mcpClients.map((c) => c.close()));
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

        // Memory extraction (non-blocking, best-effort)
        after(async () => {
          const conversationText = serialiseConversation(
            messages as Array<{ role: string; parts?: unknown[] }>
          );
          if (!conversationText) return;
          await extractMemories({
            agentId,
            sessionId: sessionId ?? null,
            userId,
            conversationText,
          });
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
    // Quota exceeded → 402
    if (e instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: "quota_exceeded", message: e.message }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
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
