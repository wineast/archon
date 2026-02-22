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
      `openai/${EMBEDDING_MODEL}`
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

    expect(createOpenAIEmbeddingMock).toHaveBeenCalledWith(EMBEDDING_MODEL);
    expect(embedMock).toHaveBeenCalledWith({
      model: "byok-model",
      value: "hello",
    });
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("propagates errors from embed()", async () => {
    embedMock.mockRejectedValue(new Error("API error"));

    await expect(generateEmbedding("hello")).rejects.toThrow("API error");
  });
});

describe("constants", () => {
  it("exports correct model and dimensions", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });
});
