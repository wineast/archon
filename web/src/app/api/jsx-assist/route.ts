import type { UIMessage } from "ai";
import { createAssistHandler } from "@/lib/ai/assist-utils";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "jsx-assist",
  buildParams: async (body) => {
    const { messages, currentJsx, agentId, sessionId } = body as {
      messages: UIMessage[];
      currentJsx: string;
      agentId?: string;
      sessionId?: string;
    };

    return {
      messages,
      agentId,
      sessionId,
      fieldContext: "component-jsx",
      currentContent: currentJsx,
      entity: "jsx",
    };
  },
});
