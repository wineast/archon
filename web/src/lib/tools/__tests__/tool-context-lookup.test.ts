import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
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

const mockGetAgentDatasets = vi.fn();
const mockGetAgentFunctions = vi.fn();

vi.mock("@/lib/pool/queries", () => ({
  getReferencedBuiltinFunctionKeys: vi.fn().mockResolvedValue(new Set()),
  getAgentDatasets: (...args: unknown[]) => mockGetAgentDatasets(...args),
  getAgentFunctions: (...args: unknown[]) => mockGetAgentFunctions(...args),
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
    mockGetAgentDatasets.mockResolvedValue([]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1", "version-1");
    const result = await ctx.dataset.get("nonexistent");
    expect(result).toBeNull();
    expect(mockGetAgentDatasets).toHaveBeenCalledWith("agent-1", "version-1");
  });

  it("get() returns string value for string dataset", async () => {
    mockGetAgentDatasets.mockResolvedValue([{ key: "company", name: "Company", data: "Acme Corp" }]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1", "version-1");
    const result = await ctx.dataset.get("company");
    expect(result).toBe("Acme Corp");
  });

  it("get() returns object for object dataset", async () => {
    mockGetAgentDatasets.mockResolvedValue([
      {
        key: "states",
        name: "States",
        data: { CA: "California", TX: "Texas" },
      },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1", "version-1");
    const result = await ctx.dataset.get("states");
    expect(result).toEqual({ CA: "California", TX: "Texas" });
  });

  it("get() resolves derived data with base dataset references", async () => {
    mockGetAgentDatasets.mockResolvedValue([
      { key: "name", name: "Name", data: "Universe" },
      {
        key: "routes",
        name: "Routes",
        data: { product: { label: "{{name}}" } },
      },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1", "version-1");
    const result = await ctx.dataset.get("routes");
    expect(result).toEqual({ product: { label: "Universe" } });
  });

  it("get() returns null when no agentId provided", async () => {
    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext(); // no agentId or versionId
    const result = await ctx.dataset.get("anything");
    expect(result).toBeNull();
    expect(mockGetAgentDatasets).not.toHaveBeenCalled();
  });

  it("get() returns null when no versionId provided", async () => {
    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1"); // no versionId
    const result = await ctx.dataset.get("anything");
    expect(result).toBeNull();
    expect(mockGetAgentDatasets).not.toHaveBeenCalled();
  });

  it("caches resolved data across multiple get() calls", async () => {
    mockGetAgentDatasets.mockResolvedValue([
      { key: "a", name: "A", data: "value_a" },
      { key: "b", name: "B", data: "value_b" },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1", "version-1");
    expect(await ctx.dataset.get("a")).toBe("value_a");
    expect(await ctx.dataset.get("b")).toBe("value_b");
    // DB should only be queried once (result is cached)
    expect(mockGetAgentDatasets).toHaveBeenCalledTimes(1);
  });

  it("fetches datasets scoped to versionId, not all versions (regression)", async () => {
    // This is the regression test for the cross-version duplicate key bug.
    // Before the fix, createToolContext only used agentId, fetching datasets from
    // ALL versions. After creating a new version, datasets with the same key but
    // different versionIds would cause a false "Circular dependency" error.
    mockGetAgentDatasets.mockResolvedValue([
      { key: "company", name: "Company", data: "Correct Version Data" },
    ]);

    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1", "version-2");
    const result = await ctx.dataset.get("company");

    // Verify it called getAgentDatasets with the correct versionId
    expect(mockGetAgentDatasets).toHaveBeenCalledWith("agent-1", "version-2");
    expect(result).toBe("Correct Version Data");
  });
});

describe("ToolContext.fn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fn() throws when no versionId provided (no functions loaded)", async () => {
    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext("agent-1"); // no versionId

    await expect(ctx.fn("anything")).rejects.toThrow('Function "anything" not found');
    // getAgentFunctions should NOT be called since versionId is missing
    expect(mockGetAgentFunctions).not.toHaveBeenCalled();
  });

  it("fn() throws when no agentId provided (no functions loaded)", async () => {
    const { createToolContext } = await import("../tool-context");
    const ctx = createToolContext(); // no agentId or versionId

    await expect(ctx.fn("anything")).rejects.toThrow('Function "anything" not found');
    expect(mockGetAgentFunctions).not.toHaveBeenCalled();
  });
});
