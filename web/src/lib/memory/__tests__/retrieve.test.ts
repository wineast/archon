import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

let configRows: unknown[] = [];
let memoryRows: unknown[] = [];

const limitMock = vi.fn(() => configRows);
const whereMock = vi.fn(() => ({ limit: limitMock }));
const fromMock = vi.fn(() => ({ where: whereMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

// For memory queries: select → from → where → orderBy → limit
const memoryLimitMock = vi.fn(() => memoryRows);
const memoryOrderByMock = vi.fn(() => ({ limit: memoryLimitMock }));
const memoryWhereMock = vi.fn(() => ({ orderBy: memoryOrderByMock }));
const memoryFromMock = vi.fn(() => ({ where: memoryWhereMock }));
const memorySelectMock = vi.fn(() => ({ from: memoryFromMock }));

let selectCallCount = 0;

const updateExecuteMock = vi.fn().mockResolvedValue(undefined);
const updateCatchMock = vi.fn(() => ({ catch: vi.fn() }));
const updateWhereMock = vi.fn(() => ({
  execute: updateExecuteMock,
  catch: updateCatchMock,
}));
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const updateMock = vi.fn(() => ({ set: updateSetMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => {
      selectCallCount++;
      // First select = config, subsequent = memories
      if (selectCallCount === 1) return selectMock();
      return memorySelectMock();
    },
    update: () => updateMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  memories: {
    id: "memories.id",
    agentId: "memories.agent_id",
    userId: "memories.user_id",
    deletedAt: "memories.deleted_at",
    expiresAt: "memories.expires_at",
    importance: "memories.importance",
    lastAccessedAt: "memories.last_accessed_at",
    embedding: "memories.embedding",
    createdAt: "memories.created_at",
  },
  memoryConfigs: {
    agentId: "memory_configs.agent_id",
    injectionMode: "memory_configs.injection_mode",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  or: vi.fn((...args: unknown[]) => ({ or: args })),
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join("?"),
      values,
    })),
    { raw: vi.fn((v: string) => v) }
  ),
}));

const generateEmbeddingMock = vi.fn();
vi.mock("@/lib/ai/embedding", () => ({
  generateEmbedding: (...args: unknown[]) => generateEmbeddingMock(...args),
}));

const { retrieveMemories } = await import("../retrieve");

describe("retrieveMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    configRows = [];
    memoryRows = [];
  });

  it("returns null when config does not exist", async () => {
    configRows = [];

    const result = await retrieveMemories({
      agentId: "agent-1",
      userId: "user-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when injectionMode is none", async () => {
    configRows = [{ injectionMode: "none", maxInjectedMemories: 10 }];

    const result = await retrieveMemories({
      agentId: "agent-1",
      userId: "user-1",
    });

    expect(result).toBeNull();
  });

  it("uses fallback when no userMessage is provided", async () => {
    configRows = [{ injectionMode: "system_prompt", maxInjectedMemories: 5 }];
    memoryRows = [{ id: "m1", content: "test memory" }];

    const result = await retrieveMemories({
      agentId: "agent-1",
      userId: "user-1",
    });

    expect(generateEmbeddingMock).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
  });

  it("uses semantic retrieval when userMessage is provided", async () => {
    configRows = [{ injectionMode: "system_prompt", maxInjectedMemories: 5 }];
    memoryRows = [{ id: "m1", content: "relevant memory" }];
    generateEmbeddingMock.mockResolvedValue([0.1, 0.2, 0.3]);

    const result = await retrieveMemories({
      agentId: "agent-1",
      userId: "user-1",
      userMessage: "hello world",
      orgId: "org-1",
    });

    expect(generateEmbeddingMock).toHaveBeenCalledWith("hello world", "org-1", undefined);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
  });

  it("falls back gracefully when embedding fails", async () => {
    configRows = [{ injectionMode: "context", maxInjectedMemories: 10 }];
    memoryRows = [{ id: "m1", content: "fallback memory" }];
    generateEmbeddingMock.mockRejectedValue(new Error("API error"));

    const result = await retrieveMemories({
      agentId: "agent-1",
      userId: "user-1",
      userMessage: "test message",
    });

    // Should still return results via fallback
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
  });

  it("returns empty items when no memories found", async () => {
    configRows = [{ injectionMode: "system_prompt", maxInjectedMemories: 5 }];
    memoryRows = [];

    const result = await retrieveMemories({
      agentId: "agent-1",
      userId: null,
    });

    expect(result).toEqual({
      config: configRows[0],
      items: [],
    });
  });
});
