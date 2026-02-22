import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mocks ── */

vi.mock("@/db/schema", () => ({
  functions: {
    id: "id",
    agentId: "agentId",
    key: "key",
    origin: "origin",
  },
  functionTestCases: Symbol("functionTestCases"),
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _tag: "and", args }),
  isNull: (col: unknown) => ({ _tag: "isNull", col }),
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
}));

/* ── helpers ── */

function createMockDb(existingRows: { id: string }[] = []) {
  const insertCalls: { table: unknown; values: unknown }[] = [];

  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: unknown) => {
        insertCalls.push({ table, values: vals });
        return {
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(
              // First insert (functions) returns inserted row; subsequent (test cases) returns []
              insertCalls.length <= 1
                ? [{ id: "fn-inserted-id" }]
                : [],
            ),
          }),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => existingRows),
      })),
    })),
    _insertCalls: insertCalls,
  };

  return db;
}

import { ensureBuiltinPoolFunctions } from "../seed-builtin-functions";

/* ── tests ── */

describe("ensureBuiltinPoolFunctions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a pool function with correct fields", async () => {
    const db = createMockDb();

    await ensureBuiltinPoolFunctions(db as never);

    // Should call insert at least once for the function
    expect(db.insert).toHaveBeenCalled();
    const funcInsert = db._insertCalls[0];
    const values = funcInsert.values as Record<string, unknown>;

    expect(values).toMatchObject({
      agentId: null,
      key: "compileExpression",
      name: "Compile Expression",
      origin: "builtin",
    });
    expect(values.code).toContain('compileExpression(input.expression)');
    expect(values.description).toBeTruthy();
    expect(values.parametersSchema).toBeTruthy();
    expect(values.returnParametersSchema).toBeTruthy();
  });

  it("calls onConflictDoNothing for idempotency", async () => {
    const db = createMockDb();

    await ensureBuiltinPoolFunctions(db as never);

    const insertResult = db.insert.mock.results[0].value.values.mock.results[0].value;
    expect(insertResult.onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("inserts test cases for the function", async () => {
    const db = createMockDb();

    await ensureBuiltinPoolFunctions(db as never);

    // Should have 2 insert calls: 1 for function + 1 for test cases
    expect(db._insertCalls.length).toBeGreaterThanOrEqual(2);

    const testCaseInsert = db._insertCalls[1];
    const tcValues = testCaseInsert.values as Record<string, unknown>[];
    expect(tcValues).toHaveLength(5);
    expect(tcValues[0]).toMatchObject({
      functionId: "fn-inserted-id",
      name: "Arithmetic",
      showAsExample: true,
    });
  });

  it("resolves existing function ID when onConflictDoNothing returns nothing", async () => {
    // Simulate: insert returns nothing (conflict), select finds existing
    const db = createMockDb([{ id: "existing-fn-id" }]);
    // Override the returning to return empty (conflict case)
    db.insert = vi.fn((table: unknown) => ({
      values: vi.fn((vals: unknown) => {
        db._insertCalls.push({ table, values: vals });
        return {
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue([]),
          }),
        };
      }),
    }));

    await ensureBuiltinPoolFunctions(db as never);

    // Should call select to find existing function
    expect(db.select).toHaveBeenCalled();

    // Should still insert test cases with the existing ID
    const testCaseInsert = db._insertCalls[1];
    const tcValues = testCaseInsert.values as Record<string, unknown>[];
    expect(tcValues[0]).toMatchObject({
      functionId: "existing-fn-id",
    });
  });
});
