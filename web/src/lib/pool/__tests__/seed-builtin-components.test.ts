import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mocks ── */

vi.mock("@/db/schema", () => ({
  components: Symbol("components"),
}));

/* ── helpers ── */

/** Creates a chainable mock db that records insert calls. */
function createMockDb() {
  const insertCalls: { table: unknown; values: unknown }[] = [];

  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: unknown) => {
        insertCalls.push({ table, values: vals });
        return { onConflictDoNothing: vi.fn() };
      }),
    })),
    _insertCalls: insertCalls,
  };

  return db;
}

import {
  ensureBuiltinPoolComponents,
  BUILTIN_COMPONENT_DEFS,
} from "../seed-builtin-components";

/* ── tests ── */

describe("ensureBuiltinPoolComponents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts one row per builtin component with correct fields", async () => {
    const db = createMockDb();

    await ensureBuiltinPoolComponents(db as never);

    expect(db.insert).toHaveBeenCalledTimes(1);
    const rows = db._insertCalls[0].values as Record<string, unknown>[];
    expect(rows).toHaveLength(4);

    // Verify each row matches the BUILTIN_COMPONENT_DEFS
    for (let i = 0; i < BUILTIN_COMPONENT_DEFS.length; i++) {
      const def = BUILTIN_COMPONENT_DEFS[i];
      expect(rows[i]).toMatchObject({
        agentId: null,
        key: def.key,
        name: def.name,
        description: def.description,
        origin: "builtin",
        componentSource: "",
        generatedCss: "",
      });
    }
  });

  it("includes all 4 expected component keys", async () => {
    const db = createMockDb();

    await ensureBuiltinPoolComponents(db as never);

    const rows = db._insertCalls[0].values as Record<string, unknown>[];
    const keys = rows.map((r) => r.key);
    expect(keys).toEqual(["badge", "spinner", "table", "tooltip"]);
  });

  it("calls onConflictDoNothing for idempotency", async () => {
    const db = createMockDb();

    await ensureBuiltinPoolComponents(db as never);

    const valuesResult = db.insert.mock.results[0].value.values.mock
      .results[0].value;
    expect(valuesResult.onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("sets componentInputSchema for each component", async () => {
    const db = createMockDb();

    await ensureBuiltinPoolComponents(db as never);

    const rows = db._insertCalls[0].values as Record<string, unknown>[];
    for (const row of rows) {
      expect(row.componentInputSchema).toBeTruthy();
      expect((row.componentInputSchema as { type: string }).type).toBe("object");
    }
  });
});
