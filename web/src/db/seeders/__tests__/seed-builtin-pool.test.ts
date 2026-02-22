import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mock builtins loaders ── */

const mockLoadBuiltinToolDefs = vi.fn();
const mockLoadBuiltinFunctionDefs = vi.fn();
const mockLoadBuiltinComponentDefs = vi.fn();
const mockLoadBuiltinWikiManifest = vi.fn();

vi.mock("@/db/builtins", () => ({
  loadBuiltinToolDefs: (...args: unknown[]) => mockLoadBuiltinToolDefs(...args),
  loadBuiltinFunctionDefs: (...args: unknown[]) => mockLoadBuiltinFunctionDefs(...args),
  loadBuiltinComponentDefs: (...args: unknown[]) => mockLoadBuiltinComponentDefs(...args),
  loadBuiltinWikiManifest: (...args: unknown[]) => mockLoadBuiltinWikiManifest(...args),
  GUIDE_DIR: "/mock/guide",
}));

vi.mock("@/db/schema", () => ({
  tools: { key: "key", agentId: "agentId", deletedAt: "deletedAt" },
  functions: { id: "id", agentId: "agentId", key: "key" },
  functionTestCases: Symbol("functionTestCases"),
  components: Symbol("components"),
  wikiDocuments: { key: "key", agentId: "agentId", deletedAt: "deletedAt" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _tag: "and", args }),
  isNull: (col: unknown) => ({ _tag: "isNull", col }),
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    _tag: "sql",
    strings: [...strings],
    values,
  }),
}));

const mockReadFileSync = vi.fn();
vi.mock("node:fs", () => ({
  default: {
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  },
}));

vi.mock("node:path", () => ({
  default: {
    join: (...args: string[]) => args.join("/"),
  },
}));

vi.mock("../../seed-utils", () => ({
  logSection: vi.fn(),
  log: vi.fn(),
}));

/* ── helpers ── */

function createMockDb() {
  const insertCalls: { table: unknown; values: unknown }[] = [];

  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: unknown) => {
        insertCalls.push({ table, values: vals });
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => [{ id: "new-id" }]),
          })),
          onConflictDoUpdate: vi.fn(),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ id: "existing-id" }]),
      })),
    })),
    _insertCalls: insertCalls,
  };

  return db;
}

import { seedBuiltinPool } from "../seed-builtin-pool";

/* ── tests ── */

describe("seedBuiltinPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadBuiltinToolDefs.mockReturnValue([]);
    mockLoadBuiltinFunctionDefs.mockReturnValue([]);
    mockLoadBuiltinComponentDefs.mockReturnValue([]);
    mockLoadBuiltinWikiManifest.mockReturnValue([]);
  });

  it("has name 'builtin-pool'", () => {
    expect(seedBuiltinPool.name).toBe("builtin-pool");
  });

  it("calls all 4 loaders", async () => {
    const db = createMockDb();
    await seedBuiltinPool.run({ db: db as never });

    expect(mockLoadBuiltinToolDefs).toHaveBeenCalledTimes(1);
    expect(mockLoadBuiltinFunctionDefs).toHaveBeenCalledTimes(1);
    expect(mockLoadBuiltinComponentDefs).toHaveBeenCalledTimes(1);
    expect(mockLoadBuiltinWikiManifest).toHaveBeenCalledTimes(1);
  });

  it("inserts tools when loader returns defs", async () => {
    mockLoadBuiltinToolDefs.mockReturnValue([
      { key: "t1", name: "t1", description: "Tool 1", parametersSchema: null },
    ]);

    const db = createMockDb();
    await seedBuiltinPool.run({ db: db as never });

    // At least one insert for tools
    expect(db.insert).toHaveBeenCalled();
    const toolInsert = db._insertCalls.find((c) => {
      const rows = c.values as Record<string, unknown>[];
      return Array.isArray(rows) && rows[0]?.key === "t1";
    });
    expect(toolInsert).toBeDefined();
  });

  it("inserts components when loader returns defs", async () => {
    mockLoadBuiltinComponentDefs.mockReturnValue([
      { key: "badge", name: "Badge", description: "Badge component" },
    ]);

    const db = createMockDb();
    await seedBuiltinPool.run({ db: db as never });

    const compInsert = db._insertCalls.find((c) => {
      const rows = c.values as Record<string, unknown>[];
      return Array.isArray(rows) && rows[0]?.key === "badge";
    });
    expect(compInsert).toBeDefined();
  });

  it("reads wiki content from guide files", async () => {
    mockLoadBuiltinWikiManifest.mockReturnValue([
      { key: "test-wiki", name: "Test Wiki", file: "test.md" },
    ]);
    mockReadFileSync.mockReturnValue("# Test Content");

    const db = createMockDb();
    await seedBuiltinPool.run({ db: db as never });

    expect(mockReadFileSync).toHaveBeenCalledWith("/mock/guide/test.md", "utf-8");
  });

  it("does not insert when all loaders return empty", async () => {
    const db = createMockDb();
    await seedBuiltinPool.run({ db: db as never });

    expect(db.insert).not.toHaveBeenCalled();
  });
});
