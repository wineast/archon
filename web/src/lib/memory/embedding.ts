import { embed } from "ai";
import { gateway } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getOrgApiKey } from "@/lib/ai/org-api-keys";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding vector for the given text.
 * Uses BYOK key if available, otherwise falls back to platform gateway.
 */
export async function generateEmbedding(
  text: string,
  orgId?: string | null
): Promise<number[]> {
  const model = await resolveEmbeddingModel(orgId);
  const { embedding } = await embed({ model, value: text });
  return embedding;
}

async function resolveEmbeddingModel(orgId?: string | null) {
  if (orgId) {
    const apiKey = await getOrgApiKey(orgId, "openai");
    if (apiKey) {
      return createOpenAI({ apiKey }).embedding(EMBEDDING_MODEL);
    }
  }
  return gateway.textEmbeddingModel(`openai/${EMBEDDING_MODEL}`);
}
