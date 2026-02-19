import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  datasets: {
    key: "key",
    data: "data",
    agentId: "agent_id",
  },
  wikiDocuments: {
    id: "id",
    title: "title",
    key: "key",
    content: "content",
    agentId: "agent_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  like: vi.fn((a, b) => ({ op: "like", a, b })),
  ilike: vi.fn((a, b) => ({ op: "ilike", a, b })),
}));

vi.mock("@/lib/template/render", () => ({
  renderWikiContent: vi.fn(),
}));

vi.mock("@/lib/wiki/frontmatter", () => ({
  parseWikiContent: vi.fn((c: string) => ({ meta: {}, content: c })),
  resolveTitle: vi.fn((c: string) => c.split("\n")[0]?.trim() || "Untitled"),
}));

function mockDbRows(rows: unknown[]) {
  mockSelect.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: () => ({
          then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
        }),
        then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
      }),
    }),
  }));
}

describe("ToolContext.dataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("get() returns null when no datasets found", async () => {
    mockDbRows([]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1");
    const result = await ctx.dataset.get("nonexistent");
    expect(result).toBeNull();
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it("get() returns string value for string dataset", async () => {
    mockDbRows([{ key: "company",data: "Acme Corp" }]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1");
    const result = await ctx.dataset.get("company");
    expect(result).toBe("Acme Corp");
  });

  it("get() returns object for object dataset", async () => {
    mockDbRows([
      {
        key: "states",
        data: { CA: "California", TX: "Texas" },
      },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1");
    const result = await ctx.dataset.get("states");
    expect(result).toEqual({ CA: "California", TX: "Texas" });
  });

  it("get() resolves derived data with base dataset references", async () => {
    mockDbRows([
      { key: "name",data: "Universe" },
      {
        key: "routes",
       
        data: { product: { label: "{{name}}" } },
      },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1");
    const result = await ctx.dataset.get("routes");
    expect(result).toEqual({ product: { label: "Universe" } });
  });

  it("getEntries() returns entries from object dataset", async () => {
    mockDbRows([
      {
        key: "products",
        data: {
          universe: {
            label: "GMCC Universe",
            states: ["CA", "TX"],
          },
          ocean: {
            label: "GMCC Ocean",
            states: ["CA"],
          },
        },
      },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1");
    const result = await ctx.dataset.getEntries("products");
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("universe");
    expect(result[0].label).toBe("GMCC Universe");
    expect(result[1].value).toBe("ocean");
    expect(result[1].label).toBe("GMCC Ocean");
  });

  it("getEntries() returns empty array for non-object datasets", async () => {
    mockDbRows([{ key: "name",data: "simple string" }]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1");
    const result = await ctx.dataset.getEntries("name");
    expect(result).toEqual([]);
  });

  it("get() returns null when no agentId provided", async () => {
    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext(); // no agentId
    const result = await ctx.dataset.get("anything");
    expect(result).toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("caches resolved data across multiple get() calls", async () => {
    mockDbRows([
      { key: "a",data: "value_a" },
      { key: "b",data: "value_b" },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1");
    expect(await ctx.dataset.get("a")).toBe("value_a");
    expect(await ctx.dataset.get("b")).toBe("value_b");
    // DB should only be queried once (result is cached)
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});
