import type { UIMessage } from "ai";
import { createAssistHandler } from "@/lib/ai/assist-utils";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "wiki-assist",
  buildParams: async (body) => {
    const { messages, currentContent, agentId, sessionId } = body as {
      messages: UIMessage[];
      currentContent: string;
      agentId?: string;
      sessionId?: string;
    };

    return {
      messages,
      agentId,
      sessionId,
      fieldContext: "wiki-content",
      currentContent,
      entity: "content",
    };
  },
});
