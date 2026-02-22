import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mocks ── */

vi.mock("@/db/schema", () => ({
  tools: {
    id: "id",
    agentId: "agentId",
    origin: "origin",
  },
  agentResourceRefs: Symbol("agentResourceRefs"),
}));

const mockBuildAllTools = vi.fn();
vi.mock("@/lib/build-chat/tools", () => ({
  buildAllTools: (...args: unknown[]) => mockBuildAllTools(...args),
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _tag: "and", args }),
  isNull: (col: unknown) => ({ _tag: "isNull", col }),
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
}));

/* ── helpers ── */

function makeSampleTools(count: number) {
  const result: Record<string, { description: string }> = {};
  for (let i = 1; i <= count; i++) {
    result[`tool_${i}`] = { description: `Tool ${i} description` };
  }
  return result;
}

/** Creates a chainable mock db that records insert/select calls. */
function createMockDb(poolToolRows: { id: string }[] = []) {
  const insertCalls: { table: unknown; values: unknown }[] = [];
  const selectCalls: { from: unknown; where: unknown }[] = [];

  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: unknown) => {
        insertCalls.push({ table, values: vals });
        return { onConflictDoNothing: vi.fn() };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn((cond: unknown) => {
          selectCalls.push({ from: table, where: cond });
          return poolToolRows;
        }),
      })),
    })),
    _insertCalls: insertCalls,
    _selectCalls: selectCalls,
  };

  return db;
}

import {
  ensureBuiltinPoolTools,
  ensureBuiltinToolRefs,
} from "../seed-builtin-tools";

/* ── tests ── */

describe("ensureBuiltinPoolTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts one row per tool with correct fields", async () => {
    mockBuildAllTools.mockReturnValue(makeSampleTools(3));
    const db = createMockDb();

    await ensureBuiltinPoolTools(db as never);

    // Should call insert once with an array of 3 rows
    expect(db.insert).toHaveBeenCalledTimes(1);
    const rows = db._insertCalls[0].values as Record<string, unknown>[];
    expect(rows).toHaveLength(3);

    // Verify field values of the first row
    expect(rows[0]).toMatchObject({
      agentId: null,
      key: "tool_1",
      name: "tool_1",
      description: "Tool 1 description",
      origin: "builtin",
      isSystem: true,
      enabled: true,
      handler: null,
      executionTarget: "server",
    });
  });

  it("calls onConflictDoNothing for idempotency", async () => {
    mockBuildAllTools.mockReturnValue(makeSampleTools(2));
    const db = createMockDb();

    await ensureBuiltinPoolTools(db as never);

    // The values() call returns an object with onConflictDoNothing
    const valuesResult = db.insert.mock.results[0].value.values.mock
      .results[0].value;
    expect(valuesResult.onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("does not insert when buildAllTools returns empty object", async () => {
    mockBuildAllTools.mockReturnValue({});
    const db = createMockDb();

    await ensureBuiltinPoolTools(db as never);

    expect(db.insert).not.toHaveBeenCalled();
    expect(db._insertCalls).toHaveLength(0);
  });
});

describe("ensureBuiltinToolRefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ref for each builtin pool tool found", async () => {
    mockBuildAllTools.mockReturnValue(makeSampleTools(2));
    const poolToolRows = [{ id: "pt-aaa" }, { id: "pt-bbb" }];
    const db = createMockDb(poolToolRows);

    await ensureBuiltinToolRefs(db as never, "agent-123");

    // 1 insert for ensureBuiltinPoolTools + 2 inserts for refs = 3
    expect(db.insert).toHaveBeenCalledTimes(3);

    // The ref inserts are calls index 1 and 2
    const refInserts = db._insertCalls.slice(1);
    expect(refInserts).toHaveLength(2);

    expect(refInserts[0].values).toMatchObject({
      agentId: "agent-123",
      resourceType: "tool",
      resourceId: "pt-aaa",
      enabled: true,
    });
    expect(refInserts[1].values).toMatchObject({
      agentId: "agent-123",
      resourceType: "tool",
      resourceId: "pt-bbb",
      enabled: true,
    });
  });

  it("creates no refs when no builtin pool tools exist", async () => {
    mockBuildAllTools.mockReturnValue(makeSampleTools(1));
    const db = createMockDb([]); // select returns empty

    await ensureBuiltinToolRefs(db as never, "agent-456");

    // 1 insert for ensureBuiltinPoolTools, 0 for refs
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db._insertCalls).toHaveLength(1);
  });

  it("calls ensureBuiltinPoolTools before selecting pool tools", async () => {
    mockBuildAllTools.mockReturnValue(makeSampleTools(1));
    const db = createMockDb([{ id: "pt-1" }]);

    await ensureBuiltinToolRefs(db as never, "agent-789");

    // insert is called before select (first call is pool tools insert)
    const insertOrder = db.insert.mock.invocationCallOrder[0];
    const selectOrder = db.select.mock.invocationCallOrder[0];
    expect(insertOrder).toBeLessThan(selectOrder);
  });
});
