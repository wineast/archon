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
import { resolveModel } from "@/lib/ai/resolve-model";
import { getOrgIdByAgentId } from "@/lib/ai/get-org-id";
import { getOrgAssistModel } from "@/lib/orgs/build-chat-settings";
import { QuotaExceededError } from "@/lib/credits/errors";

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

type StreamTextTools = NonNullable<Parameters<typeof streamText>[0]["tools"]>;

export interface AssistConfig {
  source: UsageSource;
  /** Parse the request body and return messages, optional agentId, and system prompt. */
  buildParams: (body: Record<string, unknown>) => {
    messages: UIMessage[];
    agentId?: string;
    system: string;
  };
  tools: StreamTextTools;
}

/**
 * Factory that creates a Next.js POST handler for AI assist routes.
 *
 * Shared logic:
 * - Authentication (requireAuth)
 * - Model resolution (resolveModel + quota check)
 * - streamText() call
 * - Non-blocking usage recording via after()
 */
export function createAssistHandler(config: AssistConfig) {
  return async function POST(req: Request): Promise<Response> {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { messages, agentId, system } = config.buildParams(body);

    const currentUserId = authResult.id;
    const orgId = await getOrgIdByAgentId(agentId);
    const modelId = orgId ? await getOrgAssistModel(orgId) : "anthropic/claude-sonnet-4";

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

    const result = streamText({
      model,
      messages: await convertToModelMessages(messages),
      onFinish: ({ totalUsage }) => {
        after(async () => {
          await recordUsage({
            orgId,
            agentId: agentId ?? null,
            userId: currentUserId,
            sessionId: null,
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
      },
      system,
      tools: config.tools,
    });

    return result.toUIMessageStreamResponse();
  };
}
