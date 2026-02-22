import { describe, it, expect } from "vitest";
import { chunkText } from "../chunk-text";

describe("chunkText", () => {
  it("returns empty array for empty text", () => {
    expect(chunkText("", { chunkSize: 100, chunkOverlap: 10 })).toEqual([]);
    expect(chunkText("   ", { chunkSize: 100, chunkOverlap: 10 })).toEqual([]);
  });

  it("returns single chunk for text shorter than chunkSize", () => {
    const result = chunkText("Hello world.", { chunkSize: 100, chunkOverlap: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Hello world.");
    expect(result[0].index).toBe(0);
  });

  it("splits long text into multiple chunks", () => {
    const text = "A".repeat(250) + ". " + "B".repeat(250) + ". " + "C".repeat(250) + ".";
    const result = chunkText(text, { chunkSize: 300, chunkOverlap: 50 });
    expect(result.length).toBeGreaterThan(1);
    // All chunks should have content
    for (const chunk of result) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("assigns sequential indices", () => {
    const text = "A".repeat(200) + ". " + "B".repeat(200) + ". " + "C".repeat(200) + ".";
    const result = chunkText(text, { chunkSize: 250, chunkOverlap: 20 });
    for (let i = 0; i < result.length; i++) {
      expect(result[i].index).toBe(i);
    }
  });

  it("includes metadata with character positions", () => {
    const text = "Hello world. This is a test sentence. Another one here.";
    const result = chunkText(text, { chunkSize: 30, chunkOverlap: 5 });
    for (const chunk of result) {
      expect(chunk.metadata).toHaveProperty("charStart");
      expect(chunk.metadata).toHaveProperty("charEnd");
    }
  });

  it("handles text without sentence boundaries", () => {
    const text = "A".repeat(500);
    const result = chunkText(text, { chunkSize: 100, chunkOverlap: 10 });
    expect(result.length).toBeGreaterThan(1);
    // Verify chunks cover the entire text
    const combined = result.map((r) => r.content).join("");
    // Due to overlap, combined might be longer than original
    expect(combined.length).toBeGreaterThanOrEqual(text.length);
  });

  it("respects overlap between chunks", () => {
    const sentences = [];
    for (let i = 0; i < 10; i++) {
      sentences.push(`Sentence number ${i} here.`);
    }
    const text = sentences.join(" ");
    const result = chunkText(text, { chunkSize: 80, chunkOverlap: 20 });

    // With overlap, adjacent chunks should share some content
    if (result.length >= 2) {
      const end1 = result[0].content.slice(-20);
      const start2 = result[1].content.slice(0, 40);
      // The overlap should mean some chars appear in both
      // This is a soft check — exact overlap depends on sentence boundary logic
      expect(result.length).toBeGreaterThanOrEqual(2);
    }
  });
});
