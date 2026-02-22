import { embed } from "ai";
import { gateway } from "ai";
import type { EmbeddingModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createCohere } from "@ai-sdk/cohere";
import { getOrgApiKey } from "@/lib/ai/org-api-keys";
import { parseModelId } from "@/lib/ai/resolve-model";
import type { ByokProvider } from "@/db/schema";
import { BYOK_PROVIDERS } from "@/db/schema";

export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Known embedding dimensions by model id. */
const EMBEDDING_DIMENSIONS: Record<string, number> = {
  "openai/text-embedding-3-small": 1536,
  "openai/text-embedding-3-large": 3072,
  "google/text-embedding-004": 768,
  "mistral/mistral-embed": 1024,
  "cohere/embed-multilingual-v3.0": 1024,
};

/**
 * Get the vector dimension for a given embedding model.
 * Returns 1536 as fallback for unknown models.
 */
export function getEmbeddingDimensions(modelId?: string | null): number {
  return EMBEDDING_DIMENSIONS[modelId ?? DEFAULT_EMBEDDING_MODEL] ?? 1536;
}

/* ─────────── Embedding Provider Factories ─────────── */

type EmbeddingProviderFactory = (
  apiKey: string,
  modelName: string
) => EmbeddingModel;

const EMBEDDING_PROVIDER_FACTORIES: Partial<Record<ByokProvider, EmbeddingProviderFactory>> = {
  openai: (apiKey, model) => createOpenAI({ apiKey }).embedding(model),
  google: (apiKey, model) => createGoogleGenerativeAI({ apiKey }).textEmbeddingModel(model),
  mistral: (apiKey, model) => createMistral({ apiKey }).textEmbeddingModel(model),
  cohere: (apiKey, model) => createCohere({ apiKey }).textEmbeddingModel(model),
};

/**
 * Generate an embedding vector for the given text.
 * Supports configurable model via modelId parameter.
 * Uses BYOK key if available, otherwise falls back to platform gateway.
 */
export async function generateEmbedding(
  text: string,
  orgId?: string | null,
  modelId?: string | null
): Promise<number[]> {
  const effectiveModelId = modelId || DEFAULT_EMBEDDING_MODEL;
  const model = await resolveEmbeddingModel(effectiveModelId, orgId);
  const { embedding } = await embed({ model, value: text });
  return embedding;
}

async function resolveEmbeddingModel(
  modelId: string,
  orgId?: string | null
): Promise<EmbeddingModel> {
  const parsed = parseModelId(modelId);

  if (orgId && parsed) {
    const provider = parsed.provider as ByokProvider;
    if (BYOK_PROVIDERS.includes(provider)) {
      const apiKey = await getOrgApiKey(orgId, provider);
      if (apiKey) {
        const factory = EMBEDDING_PROVIDER_FACTORIES[provider];
        if (factory) {
          return factory(apiKey, parsed.modelName);
        }
      }
    }
  }

  return gateway.textEmbeddingModel(modelId);
}
