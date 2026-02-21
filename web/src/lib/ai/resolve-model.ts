import { gateway, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { getOrgApiKey } from "./org-api-keys";
import type { ByokProvider } from "@/db/schema";
import { BYOK_PROVIDERS } from "@/db/schema";
import { getOrgCreditBalance } from "@/lib/credits/queries";
import { QuotaExceededError } from "@/lib/credits/errors";

/* ─────────── Provider Factory Map ─────────── */

type ProviderFactory = (apiKey: string, modelName: string) => LanguageModel;

const PROVIDER_FACTORIES: Record<ByokProvider, ProviderFactory> = {
  anthropic: (apiKey, model) => createAnthropic({ apiKey })(model),
  openai: (apiKey, model) => createOpenAI({ apiKey })(model),
  google: (apiKey, model) => createGoogleGenerativeAI({ apiKey })(model),
  xai: (apiKey, model) => createXai({ apiKey })(model),
  deepseek: (apiKey, model) => createDeepSeek({ apiKey })(model),
};

/* ─────────── Helpers ─────────── */

/**
 * Extract provider and model name from a modelId like "anthropic/claude-sonnet-4".
 * Supports both "/" and ":" as separators.
 */
export function parseModelId(modelId: string): { provider: string; modelName: string } | null {
  const sep = modelId.includes("/") ? "/" : modelId.includes(":") ? ":" : null;
  if (!sep) return null;
  const idx = modelId.indexOf(sep);
  return {
    provider: modelId.slice(0, idx),
    modelName: modelId.slice(idx + 1),
  };
}

/* ─────────── Public API ─────────── */

/**
 * Resolve a model for an AI call.
 *
 * If orgId is provided and the org has an active API key for the model's provider,
 * a direct provider instance is created with that key (BYOK — no credit check).
 * Otherwise, falls back to the platform gateway with credit check.
 */
export async function resolveModel(
  modelId: string,
  orgId?: string | null
): Promise<LanguageModel> {
  // No orgId → always gateway (no credit check — e.g. internal/admin calls)
  if (!orgId) return gateway(modelId);

  // Parse provider from modelId
  const parsed = parseModelId(modelId);
  if (!parsed) return gateway(modelId);

  const { provider, modelName } = parsed;

  // Check if provider is supported for BYOK
  if (!BYOK_PROVIDERS.includes(provider as ByokProvider)) {
    // Unsupported BYOK provider → gateway with credit check
    await ensureCredits(orgId);
    return gateway(modelId);
  }

  // Lookup org's API key
  const apiKey = await getOrgApiKey(orgId, provider as ByokProvider);
  if (apiKey) {
    // BYOK path — no credit check
    const factory = PROVIDER_FACTORIES[provider as ByokProvider];
    return factory(apiKey, modelName);
  }

  // Gateway fallback — check credits
  await ensureCredits(orgId);
  return gateway(modelId);
}

async function ensureCredits(orgId: string): Promise<void> {
  const balance = await getOrgCreditBalance(orgId);
  if (balance <= 0) {
    throw new QuotaExceededError();
  }
}
