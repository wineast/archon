import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mocks ── */

vi.mock("@/db/schema", () => ({
  tools: {
    id: "id",
    agentId: "agentId",
    origin: "origin",
  },
  wikiDocuments: {
    id: "id",
    agentId: "agentId",
    origin: "origin",
  },
  agentResourceRefs: Symbol("agentResourceRefs"),
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _tag: "and", args }),
  isNull: (col: unknown) => ({ _tag: "isNull", col }),
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
}));

/* ── helpers ── */

function createMockDb(poolRows: { id: string }[] = []) {
  const insertCalls: { table: unknown; values: unknown }[] = [];

  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: unknown) => {
        insertCalls.push({ table, values: vals });
        return {
          onConflictDoNothing: vi.fn(),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => poolRows),
      })),
    })),
    _insertCalls: insertCalls,
  };

  return db;
}

import { ensureBuiltinToolRefs, ensureBuiltinWikiRefs } from "../builtin-refs";

/* ── tests ── */

describe("ensureBuiltinToolRefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ref for each builtin pool tool found", async () => {
    const poolToolRows = [{ id: "pt-aaa" }, { id: "pt-bbb" }];
    const db = createMockDb(poolToolRows);

    await ensureBuiltinToolRefs(db as never, "agent-123", "version-123");

    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db._insertCalls).toHaveLength(2);

    expect(db._insertCalls[0].values).toMatchObject({
      agentId: "agent-123",
      resourceType: "tool",
      resourceId: "pt-aaa",
      enabled: true,
    });
    expect(db._insertCalls[1].values).toMatchObject({
      agentId: "agent-123",
      resourceType: "tool",
      resourceId: "pt-bbb",
      enabled: true,
    });
  });

  it("creates no refs when no builtin pool tools exist", async () => {
    const db = createMockDb([]);
    await ensureBuiltinToolRefs(db as never, "agent-456", "version-456");
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe("ensureBuiltinWikiRefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ref for each builtin pool wiki doc found", async () => {
    const poolDocRows = [{ id: "wiki-aaa" }, { id: "wiki-bbb" }];
    const db = createMockDb(poolDocRows);

    await ensureBuiltinWikiRefs(db as never, "agent-123", "version-123");

    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db._insertCalls).toHaveLength(2);

    expect(db._insertCalls[0].values).toMatchObject({
      agentId: "agent-123",
      resourceType: "wiki",
      resourceId: "wiki-aaa",
      enabled: true,
    });
    expect(db._insertCalls[1].values).toMatchObject({
      agentId: "agent-123",
      resourceType: "wiki",
      resourceId: "wiki-bbb",
      enabled: true,
    });
  });

  it("creates no refs when no builtin pool wiki docs exist", async () => {
    const db = createMockDb([]);
    await ensureBuiltinWikiRefs(db as never, "agent-456", "version-456");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
