import type { UIMessage } from "ai";
import { createAssistHandler } from "@/lib/ai/assist-utils";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "schema-code-assist",
  buildParams: async (body) => {
    const { messages, currentSchema, agentId, sessionId } = body as {
      messages: UIMessage[];
      currentSchema: string;
      agentId?: string;
      sessionId?: string;
    };

    return {
      messages,
      agentId,
      sessionId,
      fieldContext: "schema",
      currentContent: currentSchema,
      entity: "schema",
    };
  },
});
