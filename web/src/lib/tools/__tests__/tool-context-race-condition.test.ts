/**
 * 测试 ToolContext.fn() 并发竞态条件与版本隔离（Issue: concurrent-functions-exec-race-condition）
 *
 * 验证场景：
 * 1. 多个 ToolContext 并行调用 fn()，冷缓存下通过模块级 Promise 锁
 *    去重编译请求，确保只编译一次、所有调用方共享同一个 exec context
 * 2. 不同版本的 ToolContext 各自独立编译，缓存互不干扰
 * 3. 清除 draft 版本缓存不影响 published 版本正在使用的函数
 *
 * 冷缓存：全部 fulfilled（Promise 锁去重）
 * 热缓存：全部 fulfilled（直接命中缓存）
 * 版本隔离：draft/published 各自编译、互不 dispose
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

describe("ToolContext.fn() 版本隔离", () => {
  const AGENT_ID = "isolation-test-agent";
  const DRAFT_VERSION = "draft-version-id";
  const PUBLISHED_VERSION = "published-version-id";

  const ADD_FN_RECORD = [
    {
      key: "add",
      code: `export default function(input) { return input.a + input.b; }`,
      parametersSchema: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    clearFunctionCache();
  });

  it("不同版本各自独立编译，互不共享 Promise 锁", async () => {
    // 加延迟确保并发窗口
    mockGetAgentFunctions.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(ADD_FN_RECORD), 10)
        )
    );
    mockGetAgentDatasets.mockResolvedValue([]);

    const { createToolContext } = await import("../tool-context");

    // draft 和 published 各 2 个 ToolContext 并行调用
    const draftContexts = Array.from({ length: 2 }, () =>
      createToolContext(AGENT_ID, DRAFT_VERSION)
    );
    const pubContexts = Array.from({ length: 2 }, () =>
      createToolContext(AGENT_ID, PUBLISHED_VERSION)
    );

    // 全部并行
    const [draftFns, pubFns] = await Promise.all([
      Promise.all(draftContexts.map((ctx) => ctx.fn("add"))),
      Promise.all(pubContexts.map((ctx) => ctx.fn("add"))),
    ]);

    // 两组各自成功
    for (const fn of draftFns) {
      expect((fn as (input: unknown) => unknown)({ a: 1, b: 2 })).toBe(3);
    }
    for (const fn of pubFns) {
      expect((fn as (input: unknown) => unknown)({ a: 10, b: 20 })).toBe(30);
    }

    // 每个版本各编译 1 次（Promise 锁按 agentId:versionId 去重）→ 共 2 次
    expect(mockGetAgentFunctions).toHaveBeenCalledTimes(2);
    expect(mockGetAgentFunctions).toHaveBeenCalledWith(AGENT_ID, DRAFT_VERSION);
    expect(mockGetAgentFunctions).toHaveBeenCalledWith(AGENT_ID, PUBLISHED_VERSION);

    clearFunctionCache();
  });

  it("清除 draft 缓存后 published 版本函数仍可正常调用", async () => {
    mockGetAgentFunctions.mockResolvedValue(ADD_FN_RECORD);
    mockGetAgentDatasets.mockResolvedValue([]);

    const { createToolContext } = await import("../tool-context");

    // 分别预热 draft 和 published 缓存
    const draftCtx = createToolContext(AGENT_ID, DRAFT_VERSION);
    const pubCtx = createToolContext(AGENT_ID, PUBLISHED_VERSION);

    const draftAdd = await draftCtx.fn("add");
    const pubAdd = await pubCtx.fn("add");

    // 两者都正常
    expect((draftAdd as (input: unknown) => unknown)({ a: 1, b: 2 })).toBe(3);
    expect((pubAdd as (input: unknown) => unknown)({ a: 10, b: 20 })).toBe(30);

    // 模拟编辑 draft function → 只清除 draft 版本缓存
    clearFunctionCache(AGENT_ID, DRAFT_VERSION);

    // draft 的 exec 已 dispose
    expect(() => (draftAdd as (input: unknown) => unknown)({ a: 1, b: 2 })).toThrow(
      "Exec context has been disposed"
    );

    // published 不受影响，仍然可用
    expect((pubAdd as (input: unknown) => unknown)({ a: 10, b: 20 })).toBe(30);

    clearFunctionCache();
  });

  it("draft 重新编译不 dispose published 的 exec context", async () => {
    mockGetAgentFunctions.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(ADD_FN_RECORD), 5)
        )
    );
    mockGetAgentDatasets.mockResolvedValue([]);

    const { createToolContext } = await import("../tool-context");

    // 预热两个版本
    const pubCtx = createToolContext(AGENT_ID, PUBLISHED_VERSION);
    const pubAdd = await pubCtx.fn("add");
    expect((pubAdd as (input: unknown) => unknown)({ a: 5, b: 5 })).toBe(10);

    const draftCtx1 = createToolContext(AGENT_ID, DRAFT_VERSION);
    const draftAdd1 = await draftCtx1.fn("add");
    expect((draftAdd1 as (input: unknown) => unknown)({ a: 1, b: 1 })).toBe(2);

    // 清除 draft 缓存并重新编译（模拟用户编辑保存后下次调用）
    clearFunctionCache(AGENT_ID, DRAFT_VERSION);

    const draftCtx2 = createToolContext(AGENT_ID, DRAFT_VERSION);
    const draftAdd2 = await draftCtx2.fn("add");

    // 新的 draft 编译正常
    expect((draftAdd2 as (input: unknown) => unknown)({ a: 3, b: 4 })).toBe(7);

    // published 始终不受影响
    expect((pubAdd as (input: unknown) => unknown)({ a: 100, b: 200 })).toBe(300);

    clearFunctionCache();
  });
});
