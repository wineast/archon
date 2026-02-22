/**
 * Re-export from the public embedding module.
 * Memory-specific code should import from "@/lib/ai/embedding" directly.
 * This file exists for backward compatibility.
 */
export {
  generateEmbedding,
  getEmbeddingDimensions,
  DEFAULT_EMBEDDING_MODEL as EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_MODEL,
} from "@/lib/ai/embedding";

export { getEmbeddingDimensions as getEmbeddingDimensionsForModel } from "@/lib/ai/embedding";

/** @deprecated Use getEmbeddingDimensions() instead */
export const EMBEDDING_DIMENSIONS = 1536;
