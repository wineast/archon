import {
  streamText,
  gateway,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { gatherResourceSummary } from "./resource-summary";
import { buildSystemPrompt } from "./system-prompt";
import { buildAllTools } from "./tools";
import { getPlatformSettings } from "@/lib/platform-settings/queries";

export interface ExecuteBuildChatStreamOptions {
  messages: UIMessage[];
  agentId: string;
}

/**
 * Stream logic for the Build Chat assistant.
 * Uses platform-configured model & temperature, with server-side tools to operate on agent resources.
 * No message persistence — operations are persisted to resource tables.
 */
export async function executeBuildChatStream(
  opts: ExecuteBuildChatStreamOptions
): Promise<Response> {
  const { messages, agentId } = opts;

  const [summary, settings] = await Promise.all([
    gatherResourceSummary(agentId),
    getPlatformSettings(),
  ]);
  const systemPrompt = buildSystemPrompt(summary);

  const allTools = buildAllTools(agentId);

  const result = streamText({
    model: gateway(settings.buildChatModel),
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
