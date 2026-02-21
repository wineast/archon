import { db } from "@/db";
import { usageRecords, orgs } from "@/db/schema";
import type { ByokProvider } from "@/db/schema";
import { BYOK_PROVIDERS } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getUsage } from "tokenlens";
import { getOrgApiKey } from "@/lib/ai/org-api-keys";
import { parseModelId } from "@/lib/ai/resolve-model";
import { invalidateOrgCreditCache } from "@/lib/credits/queries";

export type UsageSource = "chat" | "embed" | "prompt-assist" | "jsx-assist" | "function-code-assist" | "schema-code-assist" | "tool-code-assist" | "wiki-assist" | "dataset-assist" | "eval";

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

    // Deduct credits if using platform gateway (non-BYOK)
    if (orgId && costUSD > 0) {
      const isByok = await checkIsByok(orgId, modelId);
      if (!isByok) {
        await db
          .update(orgs)
          .set({
            creditBalanceUSD: sql`${orgs.creditBalanceUSD} - ${costUSD}`,
          })
          .where(eq(orgs.id, orgId));
        invalidateOrgCreditCache(orgId);
      }
    }
  } catch (e) {
    console.error("[usage] failed to record usage:", e);
  }
}

/**
 * Check if the org has a BYOK key for the model's provider.
 */
async function checkIsByok(orgId: string, modelId: string): Promise<boolean> {
  const parsed = parseModelId(modelId);
  if (!parsed) return false;
  const { provider } = parsed;
  if (!BYOK_PROVIDERS.includes(provider as ByokProvider)) return false;
  const apiKey = await getOrgApiKey(orgId, provider as ByokProvider);
  return apiKey !== null;
}
