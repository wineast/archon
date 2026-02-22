import type { UIMessage } from "ai";
import { createAssistHandler } from "@/lib/ai/assist-utils";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "dataset-assist",
  buildParams: async (body) => {
    const { messages, currentData, agentId, sessionId } = body as {
      messages: UIMessage[];
      currentData: string;
      agentId?: string;
      sessionId?: string;
    };

    return {
      messages,
      agentId,
      sessionId,
      fieldContext: "dataset-data",
      currentContent: currentData,
      entity: "data",
    };
  },
});
