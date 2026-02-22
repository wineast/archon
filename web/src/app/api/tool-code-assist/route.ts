import type { UIMessage } from "ai";
import { createAssistHandler } from "@/lib/ai/assist-utils";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "tool-code-assist",
  buildParams: async (body) => {
    const { messages, currentCode, agentId, sessionId } = body as {
      messages: UIMessage[];
      currentCode: string;
      agentId?: string;
      sessionId?: string;
    };

    return {
      messages,
      agentId,
      sessionId,
      fieldContext: "tool-handler",
      currentContent: currentCode,
      entity: "code",
    };
  },
});
