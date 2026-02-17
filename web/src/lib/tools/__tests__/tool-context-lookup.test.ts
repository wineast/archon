import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  wikiDocuments: { id: "id", title: "title", content: "content" },
  lookupTables: { id: "id", key: "key" },
  lookupEntries: {
    tableId: "table_id",
    value: "value",
    label: "label",
    metadata: "metadata",
    order: "order",
  },
  dataObjects: { key: "key", data: "data" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  like: vi.fn((a, b) => ({ op: "like", a, b })),
  ilike: vi.fn((a, b) => ({ op: "ilike", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
}));

describe("ToolContext.lookup (lookup tables only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("get() returns empty array when table not found", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext();
    const result = await ctx.lookup.get("nonexistent");
    expect(result).toEqual([]);
    // Should only query lookupTables, NOT fall back to dataObjects
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it("get() returns entries when table exists", async () => {
    const entries = [
      { value: "CA", label: "California", metadata: null },
      { value: "TX", label: "Texas", metadata: null },
    ];

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: "table-1" }]),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(entries),
          }),
        }),
      };
    });

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext();
    const result = await ctx.lookup.get("property_state");
    expect(result).toEqual(entries);
  });

  it("find() filters entries by metadata", async () => {
    const entries = [
      { value: "CA", label: "California", metadata: { region: "west" } },
      { value: "TX", label: "Texas", metadata: { region: "south" } },
      { value: "WA", label: "Washington", metadata: { region: "west" } },
    ];

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: "table-1" }]),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(entries),
          }),
        }),
      };
    });

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext();
    const result = await ctx.lookup.find("states", { region: "west" });
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("CA");
    expect(result[1].value).toBe("WA");
  });
});

describe("ToolContext.data (data objects only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("get() returns empty array when object not found", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext();
    const result = await ctx.data.get("nonexistent");
    expect(result).toEqual([]);
    // Should only query dataObjects
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it("get() returns entries from data object", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                data: {
                  universe: {
                    label: "GMCC Universe",
                    incomes: ["NQM-WVOE"],
                    states: ["CA", "TX"],
                  },
                  ocean: {
                    label: "GMCC Ocean",
                    incomes: ["NQM-WVOE"],
                    states: ["CA"],
                  },
                },
              },
            ]),
        }),
      }),
    }));

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext();
    const result = await ctx.data.get("product_routes");
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("universe");
    expect(result[0].label).toBe("GMCC Universe");
    expect(result[1].value).toBe("ocean");
    expect(result[1].label).toBe("GMCC Ocean");
  });

  it("find() filters data object entries by metadata", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                data: {
                  universe: {
                    label: "GMCC Universe",
                    incomes: ["NQM-WVOE"],
                    states: ["CA", "TX"],
                  },
                  ocean: {
                    label: "GMCC Ocean",
                    incomes: ["NQM-WVOE"],
                    states: ["CA"],
                  },
                  thunder: {
                    label: "GMCC Thunder",
                    incomes: ["Full Doc"],
                    states: ["CA"],
                  },
                },
              },
            ]),
        }),
      }),
    }));

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext();
    const result = await ctx.data.find("product_routes", {
      incomes: "NQM-WVOE",
      states: "CA",
    });

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("universe");
    expect(result[1].value).toBe("ocean");
  });
});
