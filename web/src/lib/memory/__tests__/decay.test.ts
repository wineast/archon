import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Capture what the update().set().where().returning() chain receives ──

let selectRows: unknown[] = [];

const returningMock = vi.fn((): unknown[] => []);
const whereUpdateMock = vi.fn(() => ({ returning: returningMock }));
const setMock = vi.fn(() => ({ where: whereUpdateMock }));
const updateMock = vi.fn(() => ({ set: setMock }));

const innerJoinMock = vi.fn(() => ({ where: whereMock }));
const fromMock = vi.fn(() => ({ innerJoin: innerJoinMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));
const whereMock = vi.fn(() => selectRows);

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: {
    id: "agents.id",
    memoryEnabled: "agents.memory_enabled",
    deletedAt: "agents.deleted_at",
  },
  memories: {
    id: "memories.id",
    agentId: "memories.agent_id",
    deletedAt: "memories.deleted_at",
    importance: "memories.importance",
    lastAccessedAt: "memories.last_accessed_at",
  },
  memoryConfigs: {
    agentId: "memory_configs.agent_id",
    decayEnabled: "memory_configs.decay_enabled",
    decayDays: "memory_configs.decay_days",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join("?"),
      values,
    })),
    { raw: vi.fn() }
  ),
}));

const { decayMemories } = await import("../decay");

describe("decayMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows = [];
    returningMock.mockReturnValue([]);
  });

  it("returns zero counts when no configs have decay enabled", async () => {
    selectRows = [];

    const result = await decayMemories();

    expect(result).toEqual({ deletedCount: 0, agentCount: 0 });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("processes agents with decay enabled and counts deletions", async () => {
    selectRows = [{ agentId: "agent-1", decayDays: 30 }];

    // First update (normal): 2 records, second update (high importance): 1 record
    returningMock
      .mockReturnValueOnce([{ id: "m1" }, { id: "m2" }] as unknown[])
      .mockReturnValueOnce([{ id: "m3" }] as unknown[]);

    const result = await decayMemories();

    expect(result).toEqual({ deletedCount: 3, agentCount: 1 });
    // Two update calls: one for normal importance, one for high importance
    expect(setMock).toHaveBeenCalledTimes(2);
  });

  it("handles multiple agents independently", async () => {
    selectRows = [
      { agentId: "agent-1", decayDays: 30 },
      { agentId: "agent-2", decayDays: 60 },
    ];

    returningMock
      // agent-1: normal=1, high=0
      .mockReturnValueOnce([{ id: "m1" }] as unknown[])
      .mockReturnValueOnce([] as unknown[])
      // agent-2: normal=0, high=2
      .mockReturnValueOnce([] as unknown[])
      .mockReturnValueOnce([{ id: "m2" }, { id: "m3" }] as unknown[]);

    const result = await decayMemories();

    expect(result).toEqual({ deletedCount: 3, agentCount: 2 });
    expect(setMock).toHaveBeenCalledTimes(4);
  });

  it("does not count agents with zero deletions", async () => {
    selectRows = [{ agentId: "agent-1", decayDays: 90 }];

    returningMock
      .mockReturnValueOnce([] as unknown[])
      .mockReturnValueOnce([] as unknown[]);

    const result = await decayMemories();

    expect(result).toEqual({ deletedCount: 0, agentCount: 0 });
  });
});
