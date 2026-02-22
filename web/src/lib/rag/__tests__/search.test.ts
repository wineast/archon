import { describe, it, expect, vi } from "vitest";

// Mock the dependencies before importing
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        content: "Test chunk content",
        chunkIndex: 0,
        documentName: "test.pdf",
        score: 0.95,
      },
    ]),
  },
}));

vi.mock("@/lib/ai/embedding", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

vi.mock("@/db/schema", () => ({
  ragChunks: {
    id: "id",
    documentId: "document_id",
    agentId: "agent_id",
    content: "content",
    chunkIndex: "chunk_index",
    embedding: "embedding",
  },
  ragDocuments: {
    id: "id",
    name: "name",
  },
}));

import { ragSearch } from "../search";

describe("ragSearch", () => {
  it("returns search results", async () => {
    const results = await ragSearch(
      "agent-1",
      "test query",
      "org-1",
      "openai/text-embedding-3-small",
      5
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      content: "Test chunk content",
      documentName: "test.pdf",
      score: 0.95,
      chunkIndex: 0,
    });
  });

  it("returns empty array when no results", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.select().from(null as never).innerJoin(null as never, null as never).where(null as never).orderBy(null as never).limit).mockResolvedValueOnce([]);

    const results = await ragSearch(
      "agent-1",
      "no match",
      "org-1",
      "openai/text-embedding-3-small",
      5
    );

    expect(results).toHaveLength(0);
  });
});
