import { db } from "@/db";
import { ragChunks, ragDocuments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateEmbedding } from "@/lib/ai/embedding";

export interface RagSearchResult {
  content: string;
  documentName: string;
  score: number;
  chunkIndex: number;
}

/**
 * Perform semantic search across RAG chunks for a given agent.
 */
export async function ragSearch(
  agentId: string,
  query: string,
  orgId: string | null,
  embeddingModel: string,
  topK: number
): Promise<RagSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query, orgId, embeddingModel);
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await db
    .select({
      content: ragChunks.content,
      chunkIndex: ragChunks.chunkIndex,
      documentName: ragDocuments.name,
      score: sql<number>`1 - (${ragChunks.embedding} <=> ${sql.raw(`'${embeddingLiteral}'::vector`)})`,
    })
    .from(ragChunks)
    .innerJoin(ragDocuments, eq(ragDocuments.id, ragChunks.documentId))
    .where(eq(ragChunks.agentId, agentId))
    .orderBy(sql`${ragChunks.embedding} <=> ${sql.raw(`'${embeddingLiteral}'::vector`)} ASC`)
    .limit(topK);

  return rows.map((r) => ({
    content: r.content,
    documentName: r.documentName,
    score: r.score,
    chunkIndex: r.chunkIndex,
  }));
}
