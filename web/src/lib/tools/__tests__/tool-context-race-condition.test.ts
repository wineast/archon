/**
 * 测试 ToolContext.fn() 并发竞态条件（Issue: concurrent-functions-exec-race-condition）
 *
 * 验证场景：多个 ToolContext 并行调用 fn()，冷缓存下通过模块级 Promise 锁
 * 去重编译请求，确保只编译一次、所有调用方共享同一个 exec context。
 *
 * 冷缓存：全部 fulfilled（Promise 锁去重）
 * 热缓存：全部 fulfilled（直接命中缓存）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearFunctionCache } from "@/lib/functions/compile";

// ── Mock 外部依赖 ──

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  wikiDocuments: {},
  schemas: {},
  objectTypes: {},
  objectRelations: {},
  objectInstances: {},
  objectLinks: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  like: vi.fn(),
  ilike: vi.fn(),
  inArray: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
  isNull: vi.fn(),
}));

const mockGetAgentFunctions = vi.fn();
const mockGetAgentDatasets = vi.fn();

vi.mock("@/lib/pool/queries", () => ({
  getReferencedBuiltinFunctionKeys: vi.fn().mockResolvedValue(new Set()),
  getAgentDatasets: (...args: unknown[]) => mockGetAgentDatasets(...args),
  getAgentFunctions: (...args: unknown[]) => mockGetAgentFunctions(...args),
}));

vi.mock("@/lib/schemas/resolve-inline", () => ({
  getDefsMap: vi.fn().mockResolvedValue({}),
  resolveInlineSchema: vi.fn(),
}));

vi.mock("@/lib/template/render", () => ({
  renderWikiContent: vi.fn(),
}));

vi.mock("@/lib/wiki/frontmatter", () => ({
  parseWikiContent: vi.fn((c: string) => ({ meta: {}, content: c })),
}));

// ── 测试 ──

describe("ToolContext.fn() 并发竞态", () => {
  const AGENT_ID = "race-test-agent";
  const VERSION_ID = "race-test-version";

  beforeEach(() => {
    vi.clearAllMocks();
    clearFunctionCache(AGENT_ID);
  });

  it("冷缓存下 N 个 ToolContext 并行 fn() → 全部成功（Promise 锁去重编译）", async () => {
    // Mock: getAgentFunctions 返回一个简单的 function record
    // 加 10ms 延迟模拟编译耗时，确保并发窗口足够大
    mockGetAgentFunctions.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve([
                {
                  key: "add",
                  code: `export default function(input) { return input.a + input.b; }`,
                  parametersSchema: {
                    type: "object",
                    properties: {
                      a: { type: "number" },
                      b: { type: "number" },
                    },
                    required: ["a", "b"],
                  },
                },
              ]),
            10
          )
        )
    );
    mockGetAgentDatasets.mockResolvedValue([]);

    const { createToolContext } = await import("../tool-context");

    // 创建 4 个独立 ToolContext（模拟 4 个并行工具 handler）
    const N = 4;
    const contexts = Array.from({ length: N }, () =>
      createToolContext(AGENT_ID, VERSION_ID)
    );

    // Phase 1：全部并行调用 fn("add") → Promise 锁去重，只编译一次
    // 所有调用方共享同一个 fns Map 和 exec context
    const fnRefs = await Promise.all(
      contexts.map((ctx) => ctx.fn("add"))
    );

    // Phase 2：所有 fnRef 共享同一个 exec，全部可正常调用
    const results = await Promise.allSettled(
      fnRefs.map((fn) => {
        try {
          const result = (fn as (input: unknown) => unknown)({ a: 1, b: 2 });
          return Promise.resolve(result);
        } catch (e) {
          return Promise.reject(e);
        }
      })
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    console.log(
      `[race-condition] fulfilled: ${fulfilled.length}, rejected: ${rejected.length}`
    );
    for (const r of rejected) {
      console.log(
        `[race-condition] rejection reason:`,
        (r as PromiseRejectedResult).reason?.message
      );
    }

    // 并发编译已去重，全部成功，无 disposed 错误
    expect(rejected.length).toBe(0);
    expect(fulfilled.length).toBe(N);

    // 关键断言：编译只发生了 1 次（Promise 锁去重生效）
    expect(mockGetAgentFunctions).toHaveBeenCalledTimes(1);
    for (const r of fulfilled) {
      expect((r as PromiseFulfilledResult<number>).value).toBe(3);
    }

    // 清理
    clearFunctionCache(AGENT_ID);
  });

  it("热缓存下 N 个 ToolContext 并行 fn() → 全部成功（对照组）", async () => {
    mockGetAgentFunctions.mockResolvedValue([
      {
        key: "add",
        code: `export default function(input) { return input.a + input.b; }`,
        parametersSchema: {
          type: "object",
          properties: { a: { type: "number" }, b: { type: "number" } },
          required: ["a", "b"],
        },
      },
    ]);
    mockGetAgentDatasets.mockResolvedValue([]);

    const { createToolContext } = await import("../tool-context");

    // 先预热缓存：单独创建一个 context 编译一次
    const warmup = createToolContext(AGENT_ID, VERSION_ID);
    const warmupFn = await warmup.fn("add");
    expect((warmupFn as (input: unknown) => unknown)({ a: 0, b: 0 })).toBe(0);

    // 创建 4 个独立 ToolContext 并行调用（此时缓存已热）
    const N = 4;
    const contexts = Array.from({ length: N }, () =>
      createToolContext(AGENT_ID, VERSION_ID)
    );

    const results = await Promise.allSettled(
      contexts.map(async (ctx) => {
        const fn = await ctx.fn("add");
        return (fn as (input: unknown) => unknown)({ a: 10, b: 20 });
      })
    );

    // 热缓存下全部成功
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.length).toBe(0);

    for (const r of results) {
      expect((r as PromiseFulfilledResult<number>).value).toBe(30);
    }

    // DB 编译只发生在预热阶段（1 次），后续 4 次命中缓存
    // getAgentFunctions 被调用次数应 ≤ 热缓存前的调用（可能有竞态多调几次）
    // 关键断言：全部结果正确

    clearFunctionCache(AGENT_ID);
  });
});
