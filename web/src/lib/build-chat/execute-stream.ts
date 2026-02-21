import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { gatherResourceSummary } from "./resource-summary";
import { buildSystemPrompt } from "./system-prompt";
import { buildAllTools } from "./tools";
import { getOrgBuildChatSettings } from "@/lib/orgs/build-chat-settings";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveModel } from "@/lib/ai/resolve-model";
import { QuotaExceededError } from "@/lib/credits/errors";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_TEMPERATURE = 0.3;

export interface ExecuteBuildChatStreamOptions {
  messages: UIMessage[];
  agentId: string;
}

/**
 * Stream logic for the Build Chat assistant.
 * Uses org-configured model & temperature, with server-side tools to operate on agent resources.
 * No message persistence — operations are persisted to resource tables.
 */
export async function executeBuildChatStream(
  opts: ExecuteBuildChatStreamOptions
): Promise<Response> {
  const { messages, agentId } = opts;

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

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    temperature: settings.buildChatTemperature,
    tools: allTools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
  });
}
