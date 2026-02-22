import type { UIMessage } from "ai";
import { createAssistHandler } from "@/lib/ai/assist-utils";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "prompt-assist",
  buildParams: async (body) => {
    const { messages, currentPrompt, agentId, sessionId } = body as {
      messages: UIMessage[];
      currentPrompt: string;
      agentId?: string;
      sessionId?: string;
    };

    return {
      messages,
      agentId,
      sessionId,
      fieldContext: "system-prompt",
      currentContent: currentPrompt,
      entity: "prompt",
    };
  },
});
