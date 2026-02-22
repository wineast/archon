import { describe, it, expect } from "vitest";
import { parseModelId } from "../resolve-model";
import { BYOK_PROVIDERS } from "@/db/schema";

describe("parseModelId", () => {
  it("parses slash-separated modelId", () => {
    expect(parseModelId("anthropic/claude-sonnet-4")).toEqual({
      provider: "anthropic",
      modelName: "claude-sonnet-4",
    });
  });

  it("parses colon-separated modelId", () => {
    expect(parseModelId("openai:gpt-4o-mini")).toEqual({
      provider: "openai",
      modelName: "gpt-4o-mini",
    });
  });

  it("returns null for modelId without separator", () => {
    expect(parseModelId("gpt-4o-mini")).toBeNull();
  });

  it("handles modelId with multiple slashes", () => {
    expect(parseModelId("alibaba/qwen3-235b-a22b")).toEqual({
      provider: "alibaba",
      modelName: "qwen3-235b-a22b",
    });
  });
});

describe("BYOK_PROVIDERS", () => {
  const expectedProviders = [
    "anthropic", "openai", "google", "xai", "deepseek",
    "mistral", "cohere", "perplexity",
    "alibaba", "moonshot", "zhipu", "minimax", "bytedance",
  ];

  it("includes all 13 supported providers", () => {
    expect(BYOK_PROVIDERS).toHaveLength(13);
    for (const p of expectedProviders) {
      expect(BYOK_PROVIDERS).toContain(p);
    }
  });

  it("does NOT include meta (no direct API)", () => {
    expect(BYOK_PROVIDERS).not.toContain("meta");
  });

  it("does NOT include amazon (requires AWS credentials)", () => {
    expect(BYOK_PROVIDERS).not.toContain("amazon");
  });
});
