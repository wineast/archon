import { db } from "@/db";
import { usageRecords } from "@/db/schema";
import { getUsage } from "tokenlens";

export type UsageSource = "chat" | "embed" | "prompt-assist" | "jsx-assist" | "function-code-assist" | "schema-code-assist" | "tool-code-assist" | "eval";

interface RecordUsageParams {
  orgId?: string | null;
  agentId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  modelId: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
  };
  source: UsageSource;
}

export async function recordUsage(params: RecordUsageParams): Promise<void> {
  try {
    const { orgId, agentId, userId, sessionId, modelId, usage, source } = params;

    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    const cachedInputTokens = usage.cachedInputTokens ?? 0;
    const reasoningTokens = usage.reasoningTokens ?? 0;

    let costUSD = 0;
    try {
      const result = getUsage({
        modelId,
        usage: {
          input: inputTokens,
          output: outputTokens,
          cacheReads: cachedInputTokens,
          reasoningTokens,
        },
      });
      costUSD = result.costUSD?.totalUSD ?? 0;
    } catch {
      // Model not in tokenlens directory — degrade to 0
    }

    await db.insert(usageRecords).values({
      orgId: orgId ?? null,
      agentId: agentId ?? null,
      userId: userId ?? null,
      sessionId: sessionId ?? null,
      modelId,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningTokens,
      costUSD,
      source,
    });
  } catch (e) {
    console.error("[usage] failed to record usage:", e);
  }
}
