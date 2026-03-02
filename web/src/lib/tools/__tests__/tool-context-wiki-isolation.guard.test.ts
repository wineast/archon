/**
 * 缺陷守护：Wiki 查询 versionId 隔离
 *
 * Wiki 查询（get/findByPrefix/search）只返回当前 versionId 对应的文档，
 * 不能跨 Agent/跨版本泄露数据。
 *
 * @see .worktree/DEFECT.md
 * @see .worktree/FIX_REPORT.md
 * @see .worktree/VERIFY_REPORT.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───

const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  wikiDocuments: {
    id: "wiki_id",
    name: "wiki_name",
    key: "wiki_key",
    content: "wiki_content",
    agentId: "wiki_agent_id",
    versionId: "wiki_version_id",
  },
}));

const mockEq = vi.fn((a: unknown, b: unknown) => ({ op: "eq", a, b }));
const mockAnd = vi.fn((...args: unknown[]) => ({ op: "and", conditions: args.filter(Boolean) }));
const mockLike = vi.fn((a: unknown, b: unknown) => ({ op: "like", a, b }));
const mockIlike = vi.fn((a: unknown, b: unknown) => ({ op: "ilike", a, b }));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => mockEq(a, b),
  and: (...args: unknown[]) => mockAnd(...args),
  like: (a: unknown, b: unknown) => mockLike(a, b),
  ilike: (a: unknown, b: unknown) => mockIlike(a, b),
  inArray: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
  isNull: vi.fn(),
}));

const mockGetAgentDatasets = vi.fn();
const mockGetAgentFunctions = vi.fn();

vi.mock("@/lib/pool/queries", () => ({
  getAgentDatasets: (...args: unknown[]) => mockGetAgentDatasets(...args),
  getAgentFunctions: (...args: unknown[]) => mockGetAgentFunctions(...args),
}));

vi.mock("@/lib/template/render", () => ({
  renderWikiContent: vi.fn((_content: string, _agentId: string, _docId: string) =>
    Promise.resolve("rendered-content")
  ),
}));

vi.mock("@/lib/wiki/frontmatter", () => ({
  parseWikiContent: vi.fn((c: string) => ({ meta: {}, content: c })),
  resolveTitle: vi.fn((c: string) => c.split("\n")[0]?.trim() || "Untitled"),
}));

vi.mock("@/lib/datasets/queries", () => ({
  resolveDatasets: vi.fn(() => ({ resolvedVars: {} })),
}));

vi.mock("@/lib/functions/compile", () => ({
  resolveAndCompileFunctions: vi.fn(),
  getCachedFunctions: vi.fn(),
  setCachedFunctions: vi.fn(),
  ALL_BASE_DEPS: {},
}));

vi.mock("@/lib/schemas/resolve-inline", () => ({
  getDefsMap: vi.fn(),
}));

vi.mock("@/lib/ontology/utils", () => ({
  extractLabel: vi.fn(),
}));

vi.mock("@/lib/ontology/external-proxy", () => ({
  proxyToExternal: vi.fn(),
}));

// ─── Helpers ───

/**
 * Set up mockSelect to return given rows for all query chain patterns.
 * Captures the where() argument for assertion.
 */
let capturedWheres: unknown[];

function mockDbRows(rows: unknown[]) {
  capturedWheres = [];
  mockSelect.mockImplementation(() => ({
    from: () => ({
      where: (condition: unknown) => {
        capturedWheres.push(condition);
        return {
          limit: () => ({
            then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
          }),
          then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
        };
      },
    }),
  }));
}

const VALID_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

// ─── Tests ───

describe("Guard: Wiki 查询 versionId 隔离", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWheres = [];
  });

  describe("Cause Anchor: WHERE 子句必须包含 versionId 过滤", () => {
    it("wiki.search() 查询包含 eq(versionId, value)", async () => {
      mockDbRows([]);
      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1", "version-1");

      await ctx.wiki.search("test-query");

      // eq must be called with versionId column and actual value
      expect(mockEq).toHaveBeenCalledWith("wiki_version_id", "version-1");
      // and() must wrap versionId eq + content ilike
      expect(mockAnd).toHaveBeenCalled();
    });

    it("wiki.findByPrefix() 查询包含 eq(versionId, value)", async () => {
      mockDbRows([]);
      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1", "version-1");

      await ctx.wiki.findByPrefix("doc/");

      expect(mockEq).toHaveBeenCalledWith("wiki_version_id", "version-1");
      expect(mockAnd).toHaveBeenCalled();
    });

    it("wiki.get() UUID 路径包含 eq(versionId, value)", async () => {
      mockDbRows([{ id: VALID_UUID, content: "hello", agentId: "agent-1" }]);
      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1", "version-1");

      await ctx.wiki.get(VALID_UUID);

      // eq should be called with both wiki_id + wiki_version_id
      expect(mockEq).toHaveBeenCalledWith("wiki_id", VALID_UUID);
      expect(mockEq).toHaveBeenCalledWith("wiki_version_id", "version-1");
    });

    it("wiki.get() key fallback 包含 eq(versionId, value)", async () => {
      // First call (UUID path) returns nothing, triggers key fallback
      let callCount = 0;
      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: (condition: unknown) => {
            capturedWheres.push(condition);
            callCount++;
            const rows = callCount === 1 ? [] : [{ id: "doc-1", content: "hello", agentId: "agent-1" }];
            return {
              limit: () => ({
                then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
              }),
              then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
            };
          },
        }),
      }));

      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1", "version-1");

      await ctx.wiki.get("my-doc-key");

      // Key fallback should use versionId (not agentId)
      expect(mockEq).toHaveBeenCalledWith("wiki_version_id", "version-1");
      expect(mockEq).toHaveBeenCalledWith("wiki_key", "my-doc-key");
    });
  });

  describe("Boundary: versionId 未提供时返回空不查库", () => {
    it("wiki.get() 无 versionId → 返回 null 不查库", async () => {
      mockDbRows([{ id: "doc-1", content: "secret" }]);
      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1"); // no versionId

      const result = await ctx.wiki.get("anything");

      expect(result).toBeNull();
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("wiki.findByPrefix() 无 versionId → 返回 [] 不查库", async () => {
      mockDbRows([{ id: "doc-1", name: "Doc", content: "secret" }]);
      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1"); // no versionId

      const result = await ctx.wiki.findByPrefix("any");

      expect(result).toEqual([]);
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("wiki.search() 无 versionId → 返回 [] 不查库", async () => {
      mockDbRows([{ id: "doc-1", name: "Doc", content: "secret" }]);
      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1"); // no versionId

      const result = await ctx.wiki.search("secret");

      expect(result).toEqual([]);
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("wiki.get() 无 agentId 且无 versionId → 返回 null 不查库", async () => {
      mockDbRows([]);
      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext(); // no agentId or versionId

      const result = await ctx.wiki.get("anything");

      expect(result).toBeNull();
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("Blast Shield: 修复不影响 dataset 查询", () => {
    it("dataset.get() 仍调用 getAgentDatasets(agentId, versionId)", async () => {
      mockGetAgentDatasets.mockResolvedValue([]);

      const { createToolContext } = await import("../tool-context");
      const ctx = createToolContext("agent-1", "version-1");
      await ctx.dataset.get("company");

      // Verify dataset query still uses agentId + versionId (not broken by wiki fix)
      expect(mockGetAgentDatasets).toHaveBeenCalledWith("agent-1", "version-1");
    });
  });
});
