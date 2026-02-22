export interface ChunkResult {
  content: string;
  index: number;
  metadata: Record<string, unknown>;
}

/**
 * Split text into overlapping chunks of approximately `chunkSize` characters.
 * Attempts to split on sentence boundaries to avoid truncating sentences.
 */
export function chunkText(
  text: string,
  options: { chunkSize: number; chunkOverlap: number }
): ChunkResult[] {
  const { chunkSize, chunkOverlap } = options;

  if (!text.trim()) return [];
  if (text.length <= chunkSize) {
    return [{ content: text.trim(), index: 0, metadata: {} }];
  }

  const chunks: ChunkResult[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to find a sentence boundary near the end
    if (end < text.length) {
      const searchStart = Math.max(end - Math.floor(chunkSize * 0.2), start);
      const segment = text.slice(searchStart, end);
      const sentenceEnd = findLastSentenceBoundary(segment);
      if (sentenceEnd !== -1) {
        end = searchStart + sentenceEnd + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push({
        content: chunk,
        index: chunks.length,
        metadata: { charStart: start, charEnd: end },
      });
    }

    // Move start forward, accounting for overlap
    const step = end - start - chunkOverlap;
    start += Math.max(step, 1);
  }

  return chunks;
}

/**
 * Find the last sentence boundary (. ! ? followed by whitespace or end) in a string.
 * Returns the index of the sentence-ending punctuation, or -1 if not found.
 */
function findLastSentenceBoundary(text: string): number {
  // Match sentence-ending punctuation followed by whitespace or end of string
  const regex = /[.!?。！？]\s/g;
  let lastIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}
