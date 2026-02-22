import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─────────── Mock: DB ─────────── */

let selectRows: unknown[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateSetMock = vi.fn((_set: any) => ({ where: vi.fn() }));
const updateMock = vi.fn(() => ({ set: updateSetMock }));
const limitMock = vi.fn(() => selectRows);
const whereSelectMock = vi.fn(() => ({ limit: limitMock }));
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectFieldsMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectFieldsMock(),
    update: () => updateMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  chatSessions: {
    id: "chat_sessions.id",
    metadata: "chat_sessions.metadata",
    updatedAt: "chat_sessions.updated_at",
  },
  models: {
    modelId: "models.model_id",
    contextWindow: "models.context_window",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

/* ─────────── Mock: tokenlens ─────────── */

const getContextWindowMock = vi.fn();
vi.mock("tokenlens", () => ({
  getContextWindow: (...args: unknown[]) => getContextWindowMock(...args),
}));

/* ─────────── Mock: AI SDK ─────────── */

const generateTextMock = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

/* ─────────── Mock: resolveModel ─────────── */

vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn(() => "mock-model"),
}));

/* ─────────── Import after mocks ─────────── */

const {
  shouldCompress,
  compressMessages,
  getCompressionData,
  saveCompressionData,
  getInputMax,
  KEEP_RECENT_COUNT,
} = await import("../compress");

describe("shouldCompress", () => {
  it("returns true when inputTokens exceeds threshold", () => {
    // threshold = 100_000 * 0.75 = 75_000
    expect(shouldCompress(80_000, 100_000)).toBe(true);
  });

  it("returns false when inputTokens is below threshold", () => {
    expect(shouldCompress(50_000, 100_000)).toBe(false);
  });

  it("returns false at exactly the threshold", () => {
    expect(shouldCompress(75_000, 100_000)).toBe(false);
  });

  it("works with large context windows", () => {
    // 1M context: threshold = 750_000
    expect(shouldCompress(800_000, 1_000_000)).toBe(true);
    expect(shouldCompress(700_000, 1_000_000)).toBe(false);
  });
});

describe("getInputMax", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows = [];
  });

  it("returns DB contextWindow when available", async () => {
    selectRows = [{ contextWindow: 200_000 }];
    const result = await getInputMax("anthropic/claude-sonnet-4");
    expect(result).toBe(200_000);
  });

  it("falls back to tokenlens when DB has no value", async () => {
    selectRows = [{ contextWindow: null }];
    getContextWindowMock.mockReturnValue({ inputMax: 150_000 });
    const result = await getInputMax("some/model");
    expect(result).toBe(150_000);
  });

  it("falls back to 128K when both DB and tokenlens have no data", async () => {
    selectRows = [{ contextWindow: null }];
    getContextWindowMock.mockReturnValue(null);
    const result = await getInputMax("unknown/model");
    expect(result).toBe(128_000);
  });

  it("falls back to 128K when model not found in DB", async () => {
    selectRows = [];
    getContextWindowMock.mockReturnValue(null);
    const result = await getInputMax("nonexistent/model");
    expect(result).toBe(128_000);
  });
});

describe("compressMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateText with correct system prompt and returns summary", async () => {
    generateTextMock.mockResolvedValue({ text: "这是压缩后的摘要" });

    const result = await compressMessages("用户: 你好\n\n助手: 你好！", "org-1");

    expect(result).toBe("这是压缩后的摘要");
    expect(generateTextMock).toHaveBeenCalledOnce();
    const call = generateTextMock.mock.calls[0][0];
    expect(call.system).toContain("对话摘要助手");
    expect(call.prompt).toBe("用户: 你好\n\n助手: 你好！");
  });
});

describe("getCompressionData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows = [];
  });

  it("returns null when session has no metadata", async () => {
    selectRows = [{ metadata: null }];
    const result = await getCompressionData("session-1");
    expect(result).toBeNull();
  });

  it("returns null when metadata has no compression field", async () => {
    selectRows = [{ metadata: { other: "data" } }];
    const result = await getCompressionData("session-1");
    expect(result).toBeNull();
  });

  it("returns compression data when present", async () => {
    const compression = {
      summary: "test summary",
      compressedCount: 10,
      lastCompressedAt: "2026-01-01T00:00:00.000Z",
    };
    selectRows = [{ metadata: { compression } }];
    const result = await getCompressionData("session-1");
    expect(result).toEqual(compression);
  });

  it("returns compression data with lastInputTokens", async () => {
    const compression = {
      summary: "test summary",
      compressedCount: 10,
      lastCompressedAt: "2026-01-01T00:00:00.000Z",
      lastInputTokens: 85_000,
    };
    selectRows = [{ metadata: { compression } }];
    const result = await getCompressionData("session-1");
    expect(result).toEqual(compression);
    expect(result?.lastInputTokens).toBe(85_000);
  });

  it("returns null when session not found", async () => {
    selectRows = [];
    const result = await getCompressionData("session-1");
    expect(result).toBeNull();
  });
});

describe("saveCompressionData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows = [];
  });

  it("merges compression into existing metadata", async () => {
    selectRows = [{ metadata: { existingKey: "value" } }];
    const data = {
      summary: "new summary",
      compressedCount: 5,
      lastCompressedAt: "2026-01-01T00:00:00.000Z",
    };

    await saveCompressionData("session-1", data);

    expect(updateSetMock).toHaveBeenCalledOnce();
    const setArg = updateSetMock.mock.calls[0]?.[0] as
      | { metadata: Record<string, unknown> }
      | undefined;
    expect(setArg?.metadata).toEqual({
      existingKey: "value",
      compression: data,
    });
  });

  it("creates metadata when session has none", async () => {
    selectRows = [{ metadata: null }];
    const data = {
      summary: "summary",
      compressedCount: 3,
      lastCompressedAt: "2026-01-01T00:00:00.000Z",
    };

    await saveCompressionData("session-1", data);

    const setArg = updateSetMock.mock.calls[0]?.[0] as
      | { metadata: Record<string, unknown> }
      | undefined;
    expect(setArg?.metadata).toEqual({ compression: data });
  });

  it("persists lastInputTokens in compression data", async () => {
    selectRows = [{ metadata: {} }];
    const data = {
      summary: "summary",
      compressedCount: 3,
      lastCompressedAt: "2026-01-01T00:00:00.000Z",
      lastInputTokens: 92_000,
    };

    await saveCompressionData("session-1", data);

    const setArg = updateSetMock.mock.calls[0]?.[0] as
      | { metadata: Record<string, unknown> }
      | undefined;
    expect(setArg?.metadata).toEqual({ compression: data });
  });
});

describe("KEEP_RECENT_COUNT", () => {
  it("is a positive number", () => {
    expect(KEEP_RECENT_COUNT).toBeGreaterThan(0);
    expect(KEEP_RECENT_COUNT).toBe(10);
  });
});
