import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => {
  const col = (name: string) => name;
  return {
    tools: {
      id: col("id"),
      agentId: col("agent_id"),
      versionId: col("version_id"),
      name: col("name"),
      enabled: col("enabled"),
      deletedAt: col("deleted_at"),
    },
    components: {
      id: col("id"),
      agentId: col("agent_id"),
      versionId: col("version_id"),
      deletedAt: col("deleted_at"),
    },
    functions: {
      id: col("id"),
      agentId: col("agent_id"),
      versionId: col("version_id"),
      deletedAt: col("deleted_at"),
    },
    datasets: {
      id: col("id"),
      agentId: col("agent_id"),
      versionId: col("version_id"),
      key: col("key"),
      name: col("name"),
      data: col("data"),
      deletedAt: col("deleted_at"),
    },
    wikiDocuments: {
      id: col("id"),
      agentId: col("agent_id"),
      versionId: col("version_id"),
      parentId: col("parent_id"),
      name: col("name"),
      key: col("key"),
      content: col("content"),
      order: col("order"),
      createdAt: col("created_at"),
      updatedAt: col("updated_at"),
      deletedAt: col("deleted_at"),
    },
    schemas: {
      id: col("id"),
      agentId: col("agent_id"),
      versionId: col("version_id"),
      deletedAt: col("deleted_at"),
    },
    mcpServers: {
      id: col("id"),
      agentId: col("agent_id"),
      versionId: col("version_id"),
      enabled: col("enabled"),
      deletedAt: col("deleted_at"),
    },
    agentResourceRefs: {
      id: col("ref_id"),
      agentId: col("ref_agent_id"),
      versionId: col("ref_version_id"),
      resourceType: col("ref_resource_type"),
      resourceId: col("ref_resource_id"),
      enabled: col("ref_enabled"),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  isNull: vi.fn((a) => ({ op: "isNull", a })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up the mock db chain for two sequential select() calls.
 * The first call returns `privateRows`, the second returns `poolRows`.
 *
 * Pool queries use `.from().innerJoin().where()` chain, while
 * private queries use `.from().where()` chain. We unify both via
 * a thenable object that satisfies either chain shape.
 */
function setupTwoQueries(privateRows: unknown[], poolRows: unknown[]) {
  let callIdx = 0;
  const allResults = [privateRows, poolRows];

  mockSelect.mockImplementation(() => {
    const rows = allResults[callIdx] ?? [];
    callIdx++;
    const thenable = {
      then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
    };
    return {
      from: () => ({
        where: () => thenable,
        innerJoin: () => ({
          where: () => thenable,
        }),
        then: thenable.then,
      }),
    };
  });
}

const AGENT_ID = "agent-test-1";
const VERSION_ID = "version-test-1";

// ---------------------------------------------------------------------------
// Tests — getAgentResources (generic)
// ---------------------------------------------------------------------------

describe("getAgentResources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns private resources with _source='private'", async () => {
    const privateTool = { id: "t1", agentId: AGENT_ID, name: "private-tool" };
    setupTwoQueries([privateTool], []);

    const { getAgentResources } = await import("../queries");
    const result = await getAgentResources(AGENT_ID, "tool", VERSION_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "t1",
      name: "private-tool",
      _source: "private",
    });
    expect(result[0]._refId).toBeUndefined();
    expect(result[0]._refEnabled).toBeUndefined();
  });

  it("returns pool resources with _source='pool' and ref metadata", async () => {
    const poolTool = { id: "t2", agentId: null, name: "pool-tool" };
    setupTwoQueries([], [
      { resource: poolTool, refId: "ref-1", refEnabled: true },
    ]);

    const { getAgentResources } = await import("../queries");
    const result = await getAgentResources(AGENT_ID, "tool", VERSION_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "t2",
      name: "pool-tool",
      _source: "pool",
      _refId: "ref-1",
      _refEnabled: true,
    });
  });

  it("merges private and pool resources in order", async () => {
    const priv = { id: "t1", agentId: AGENT_ID, name: "private" };
    const pool = { id: "t2", agentId: null, name: "pool" };
    setupTwoQueries([priv], [
      { resource: pool, refId: "ref-2", refEnabled: false },
    ]);

    const { getAgentResources } = await import("../queries");
    const result = await getAgentResources(AGENT_ID, "tool", VERSION_ID);

    expect(result).toHaveLength(2);
    expect(result[0]._source).toBe("private");
    expect(result[1]._source).toBe("pool");
    expect(result[1]._refEnabled).toBe(false);
  });

  it("returns empty array when no resources exist", async () => {
    setupTwoQueries([], []);

    const { getAgentResources } = await import("../queries");
    const result = await getAgentResources(AGENT_ID, "component", VERSION_ID);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — getAgentEnabledTools
// ---------------------------------------------------------------------------

describe("getAgentEnabledTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns private enabled tools and pool enabled tools merged", async () => {
    const privateTool = { id: "t1", agentId: AGENT_ID, name: "priv-tool", enabled: true };
    const poolTool = { id: "t2", agentId: null, name: "pool-tool", enabled: true };
    setupTwoQueries([privateTool], [{ resource: poolTool }]);

    const { getAgentEnabledTools } = await import("../queries");
    const result = await getAgentEnabledTools(AGENT_ID, VERSION_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "t1", name: "priv-tool" });
    expect(result[1]).toMatchObject({ id: "t2", name: "pool-tool" });
  });

  it("returns empty array when no enabled tools exist", async () => {
    setupTwoQueries([], []);

    const { getAgentEnabledTools } = await import("../queries");
    const result = await getAgentEnabledTools(AGENT_ID, VERSION_ID);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — getAgentEnabledMcpServers
// ---------------------------------------------------------------------------

describe("getAgentEnabledMcpServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns private and pool enabled MCP servers", async () => {
    const privMcp = { id: "mcp1", agentId: AGENT_ID, enabled: true };
    const poolMcp = { id: "mcp2", agentId: null, enabled: true };
    setupTwoQueries([privMcp], [{ resource: poolMcp }]);

    const { getAgentEnabledMcpServers } = await import("../queries");
    const result = await getAgentEnabledMcpServers(AGENT_ID, VERSION_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "mcp1" });
    expect(result[1]).toMatchObject({ id: "mcp2" });
  });

  it("returns empty array when no MCP servers exist", async () => {
    setupTwoQueries([], []);

    const { getAgentEnabledMcpServers } = await import("../queries");
    const result = await getAgentEnabledMcpServers(AGENT_ID, VERSION_ID);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — getAgentDatasets
// ---------------------------------------------------------------------------

describe("getAgentDatasets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns private and pool datasets with key/name/data fields", async () => {
    const privDs = { key: "company", name: "Company", data: "Acme" };
    const poolDs = { key: "region", name: "Region", data: { us: "US" } };
    setupTwoQueries([privDs], [poolDs]);

    const { getAgentDatasets } = await import("../queries");
    const result = await getAgentDatasets(AGENT_ID, VERSION_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: "company", data: "Acme" });
    expect(result[1]).toMatchObject({ key: "region", data: { us: "US" } });
  });
});

// ---------------------------------------------------------------------------
// Tests — getAgentWikiDocs
// ---------------------------------------------------------------------------

describe("getAgentWikiDocs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns private and pool wiki documents", async () => {
    const now = new Date();
    const privDoc = {
      id: "w1", parentId: null, name: "FAQ", key: "faq",
      content: "Q&A", order: 0, createdAt: now, updatedAt: now,
    };
    const poolDoc = {
      id: "w2", parentId: null, name: "Guide", key: "guide",
      content: "How to", order: 1, createdAt: now, updatedAt: now,
    };
    setupTwoQueries([privDoc], [poolDoc]);

    const { getAgentWikiDocs } = await import("../queries");
    const result = await getAgentWikiDocs(AGENT_ID, VERSION_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "w1", key: "faq" });
    expect(result[1]).toMatchObject({ id: "w2", key: "guide" });
  });
});

// ---------------------------------------------------------------------------
// Tests — getAgentSchemas
// ---------------------------------------------------------------------------

describe("getAgentSchemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns private and pool schemas merged", async () => {
    const privSchema = { id: "s1", agentId: AGENT_ID, key: "user" };
    const poolSchema = { id: "s2", agentId: null, key: "order" };
    setupTwoQueries([privSchema], [{ resource: poolSchema }]);

    const { getAgentSchemas } = await import("../queries");
    const result = await getAgentSchemas(AGENT_ID, VERSION_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "s1", key: "user" });
    expect(result[1]).toMatchObject({ id: "s2", key: "order" });
  });
});
