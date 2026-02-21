import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─────────── Mock: DB ─────────── */

let selectRows: unknown[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateSetMock = vi.fn((_set: any) => ({ where: vi.fn() }));
const updateMock = vi.fn(() => ({ set: updateSetMock }));
const limitMock = vi.fn(() => selectRows);
const whereSelectMock = vi.fn(() => ({ limit: limitMock }));
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  chatSessions: {
    id: "chat_sessions.id",
    metadata: "chat_sessions.metadata",
    updatedAt: "chat_sessions.updated_at",
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
  KEEP_RECENT_COUNT,
} = await import("../compress");

describe("shouldCompress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when inputTokens exceeds threshold", () => {
    getContextWindowMock.mockReturnValue({ inputMax: 100_000 });
    // threshold = 100_000 * 0.75 = 75_000
    expect(shouldCompress(80_000, "anthropic/claude-sonnet-4")).toBe(true);
  });

  it("returns false when inputTokens is below threshold", () => {
    getContextWindowMock.mockReturnValue({ inputMax: 100_000 });
    expect(shouldCompress(50_000, "anthropic/claude-sonnet-4")).toBe(false);
  });

  it("returns false at exactly the threshold", () => {
    getContextWindowMock.mockReturnValue({ inputMax: 100_000 });
    expect(shouldCompress(75_000, "anthropic/claude-sonnet-4")).toBe(false);
  });

  it("uses fallback inputMax when tokenlens returns null", () => {
    getContextWindowMock.mockReturnValue(null);
    // fallback = 128_000, threshold = 96_000
    expect(shouldCompress(100_000, "unknown/model")).toBe(true);
    expect(shouldCompress(90_000, "unknown/model")).toBe(false);
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
});

describe("KEEP_RECENT_COUNT", () => {
  it("is a positive number", () => {
    expect(KEEP_RECENT_COUNT).toBeGreaterThan(0);
    expect(KEEP_RECENT_COUNT).toBe(10);
  });
});
