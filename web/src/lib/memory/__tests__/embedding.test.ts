import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock ai SDK ──

const embedMock = vi.fn();
const gatewayEmbeddingMock = vi.fn((_id: unknown) => "gateway-model");
const createOpenAIEmbeddingMock = vi.fn((_id: unknown) => "byok-model");

vi.mock("ai", () => ({
  embed: (arg: unknown) => embedMock(arg),
  gateway: {
    textEmbeddingModel: (arg: unknown) => gatewayEmbeddingMock(arg),
  },
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn((_opts: unknown) => ({
    embedding: (arg: unknown) => createOpenAIEmbeddingMock(arg),
  })),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(),
}));

vi.mock("@ai-sdk/mistral", () => ({
  createMistral: vi.fn(),
}));

vi.mock("@ai-sdk/cohere", () => ({
  createCohere: vi.fn(),
}));

vi.mock("@/lib/ai/resolve-model", () => ({
  parseModelId: (id: string) => {
    const sep = id.includes("/") ? "/" : null;
    if (!sep) return null;
    const idx = id.indexOf(sep);
    return { provider: id.slice(0, idx), modelName: id.slice(idx + 1) };
  },
}));

vi.mock("@/db/schema", () => ({
  BYOK_PROVIDERS: [
    "anthropic", "openai", "google", "xai", "deepseek",
    "mistral", "cohere", "perplexity",
    "alibaba", "moonshot", "zhipu", "minimax", "bytedance",
  ],
}));

const getOrgApiKeyMock = vi.fn();
vi.mock("@/lib/ai/org-api-keys", () => ({
  getOrgApiKey: (a: unknown, b: unknown) => getOrgApiKeyMock(a, b),
}));

const { generateEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } =
  await import("../embedding");

describe("generateEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    embedMock.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
  });

  it("uses gateway when no orgId", async () => {
    const result = await generateEmbedding("hello");

    expect(gatewayEmbeddingMock).toHaveBeenCalledWith(
      "openai/text-embedding-3-small"
    );
    expect(embedMock).toHaveBeenCalledWith({
      model: "gateway-model",
      value: "hello",
    });
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("uses gateway when orgId has no API key", async () => {
    getOrgApiKeyMock.mockResolvedValue(null);

    const result = await generateEmbedding("hello", "org-1");

    expect(getOrgApiKeyMock).toHaveBeenCalledWith("org-1", "openai");
    expect(gatewayEmbeddingMock).toHaveBeenCalled();
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("uses BYOK when orgId has API key", async () => {
    getOrgApiKeyMock.mockResolvedValue("sk-test-key");

    const result = await generateEmbedding("hello", "org-1");

    expect(createOpenAIEmbeddingMock).toHaveBeenCalledWith("text-embedding-3-small");
    expect(embedMock).toHaveBeenCalledWith({
      model: "byok-model",
      value: "hello",
    });
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("supports custom modelId parameter", async () => {
    const result = await generateEmbedding("hello", null, "openai/text-embedding-3-large");

    expect(gatewayEmbeddingMock).toHaveBeenCalledWith(
      "openai/text-embedding-3-large"
    );
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("propagates errors from embed()", async () => {
    embedMock.mockRejectedValue(new Error("API error"));

    await expect(generateEmbedding("hello")).rejects.toThrow("API error");
  });
});

describe("constants", () => {
  it("exports correct model and dimensions", () => {
    expect(EMBEDDING_MODEL).toBe("openai/text-embedding-3-small");
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });
});
