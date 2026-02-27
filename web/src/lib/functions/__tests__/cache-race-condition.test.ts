/**
 * 测试 FunctionsExec 缓存竞态条件与版本隔离（Issue: concurrent-functions-exec-race-condition）
 *
 * 验证目标：
 * 1. setCachedFunctions 覆盖缓存时 dispose 旧 exec，导致持有旧 fns 引用的调用方抛错
 * 2. 修复后：并发调用应共享同一编译结果，不发生 dispose 冲突
 * 3. 缓存按 agentId:versionId 隔离，不同版本互不干扰
 * 4. clearFunctionCache 支持三种粒度：全部、按 agent、按 agent+version
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveAndCompileFunctions,
  setCachedFunctions,
  getCachedFunctions,
  clearFunctionCache,
  type FunctionRecord,
} from "../compile";

const SIMPLE_FN: FunctionRecord[] = [
  {
    key: "add",
    code: `export default function(input) { return input.a + input.b; }`,
    parameters: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
];

describe("setCachedFunctions dispose 破坏旧 fns 引用", () => {
  const AGENT_ID = "test-agent-race";
  const VERSION_ID = "test-version-1";

  beforeEach(() => {
    clearFunctionCache();
  });

  it("覆盖缓存后，旧 fns 中的函数调用应抛 'Exec context has been disposed'", async () => {
    // 模拟第一个 ToolContext 编译并写入缓存
    const { fns: fns1, exec: exec1 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, VERSION_ID, fns1, exec1);

    // 此时 fns1 正常可用
    const addFn1 = fns1.get("add") as (input: unknown) => unknown;
    expect(addFn1({ a: 1, b: 2 })).toBe(3);

    // 模拟第二个 ToolContext 也编译完成并覆盖缓存 → dispose exec1
    const { fns: fns2, exec: exec2 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, VERSION_ID, fns2, exec2);

    // fns1 中的函数仍持有 exec1 闭包引用，但 exec1 已被 dispose
    expect(() => addFn1({ a: 1, b: 2 })).toThrow("Exec context has been disposed");

    // fns2 中的函数正常工作
    const addFn2 = fns2.get("add") as (input: unknown) => unknown;
    expect(addFn2({ a: 1, b: 2 })).toBe(3);

    exec2.dispose();
  });

  it("N 次连续覆盖后，仅最后一个 exec 存活", async () => {
    const N = 4;
    const compilations = await Promise.all(
      Array.from({ length: N }, () => resolveAndCompileFunctions(SIMPLE_FN))
    );

    // 依次写入缓存（模拟并发编译完成的先后顺序）
    for (const { fns, exec } of compilations) {
      setCachedFunctions(AGENT_ID, VERSION_ID, fns, exec);
    }

    // 前 N-1 个 fns 的函数全部抛错
    for (let i = 0; i < N - 1; i++) {
      const fn = compilations[i].fns.get("add") as (input: unknown) => unknown;
      expect(() => fn({ a: 1, b: 2 })).toThrow("Exec context has been disposed");
    }

    // 最后一个正常工作
    const lastFn = compilations[N - 1].fns.get("add") as (input: unknown) => unknown;
    expect(lastFn({ a: 1, b: 2 })).toBe(3);

    compilations[N - 1].exec.dispose();
  });

  it("getCachedFunctions 命中缓存时，所有调用方共享同一个 fns（热缓存安全）", async () => {
    const { fns, exec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, VERSION_ID, fns, exec);

    // 多个调用方同时命中缓存 → 拿到同一个 fns 引用
    const cached1 = getCachedFunctions(AGENT_ID, VERSION_ID);
    const cached2 = getCachedFunctions(AGENT_ID, VERSION_ID);
    expect(cached1).toBe(cached2);
    expect(cached1).toBe(fns);

    // 所有引用指向同一个 exec，都能正常调用
    const fn1 = cached1!.get("add") as (input: unknown) => unknown;
    const fn2 = cached2!.get("add") as (input: unknown) => unknown;
    expect(fn1({ a: 10, b: 20 })).toBe(30);
    expect(fn2({ a: 10, b: 20 })).toBe(30);

    exec.dispose();
  });
});

describe("版本隔离", () => {
  const AGENT_ID = "test-agent-isolation";
  const AGENT_ID_2 = "test-agent-isolation-2";
  const DRAFT_VERSION = "draft-version";
  const PUBLISHED_VERSION = "published-version";

  beforeEach(() => {
    clearFunctionCache();
  });

  it("不同版本的缓存互相独立，getCachedFunctions 按 agentId+versionId 命中", async () => {
    const { fns: draftFns, exec: draftExec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, DRAFT_VERSION, draftFns, draftExec);

    const { fns: pubFns, exec: pubExec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, PUBLISHED_VERSION, pubFns, pubExec);

    // 各自命中各自的缓存，引用不同
    expect(getCachedFunctions(AGENT_ID, DRAFT_VERSION)).toBe(draftFns);
    expect(getCachedFunctions(AGENT_ID, PUBLISHED_VERSION)).toBe(pubFns);
    expect(draftFns).not.toBe(pubFns);

    // 两者都能正常工作
    const draftAdd = draftFns.get("add") as (input: unknown) => unknown;
    const pubAdd = pubFns.get("add") as (input: unknown) => unknown;
    expect(draftAdd({ a: 1, b: 2 })).toBe(3);
    expect(pubAdd({ a: 10, b: 20 })).toBe(30);

    draftExec.dispose();
    pubExec.dispose();
  });

  it("setCachedFunctions 覆盖同一版本不影响其他版本", async () => {
    // 为 draft 和 published 各缓存一份
    const { fns: draftFns1, exec: draftExec1 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, DRAFT_VERSION, draftFns1, draftExec1);

    const { fns: pubFns, exec: pubExec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, PUBLISHED_VERSION, pubFns, pubExec);

    // 覆盖 draft 缓存（模拟编辑 draft function 后重新编译）
    const { fns: draftFns2, exec: draftExec2 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, DRAFT_VERSION, draftFns2, draftExec2);

    // 旧 draft exec 被 dispose
    const oldDraftAdd = draftFns1.get("add") as (input: unknown) => unknown;
    expect(() => oldDraftAdd({ a: 1, b: 2 })).toThrow("Exec context has been disposed");

    // 新 draft 正常
    const newDraftAdd = draftFns2.get("add") as (input: unknown) => unknown;
    expect(newDraftAdd({ a: 1, b: 2 })).toBe(3);

    // published 不受影响
    const pubAdd = pubFns.get("add") as (input: unknown) => unknown;
    expect(pubAdd({ a: 10, b: 20 })).toBe(30);

    draftExec2.dispose();
    pubExec.dispose();
  });

  it("clearFunctionCache(agentId, versionId) 只清除指定版本，不影响其他版本", async () => {
    const { fns: draftFns, exec: draftExec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, DRAFT_VERSION, draftFns, draftExec);

    const { fns: pubFns, exec: pubExec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, PUBLISHED_VERSION, pubFns, pubExec);

    // 只清除 draft 版本
    clearFunctionCache(AGENT_ID, DRAFT_VERSION);

    // draft 被 dispose，published 不受影响
    const draftAdd = draftFns.get("add") as (input: unknown) => unknown;
    expect(() => draftAdd({ a: 1, b: 2 })).toThrow("Exec context has been disposed");

    const pubAdd = pubFns.get("add") as (input: unknown) => unknown;
    expect(pubAdd({ a: 10, b: 20 })).toBe(30);

    expect(getCachedFunctions(AGENT_ID, DRAFT_VERSION)).toBeUndefined();
    expect(getCachedFunctions(AGENT_ID, PUBLISHED_VERSION)).toBe(pubFns);

    pubExec.dispose();
  });

  it("clearFunctionCache(agentId) 清除该 agent 所有版本的缓存", async () => {
    const { fns: draftFns, exec: draftExec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, DRAFT_VERSION, draftFns, draftExec);

    const { fns: pubFns, exec: pubExec } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, PUBLISHED_VERSION, pubFns, pubExec);

    // 只传 agentId → 清除所有版本
    clearFunctionCache(AGENT_ID);

    const draftAdd = draftFns.get("add") as (input: unknown) => unknown;
    const pubAdd = pubFns.get("add") as (input: unknown) => unknown;
    expect(() => draftAdd({ a: 1, b: 2 })).toThrow("Exec context has been disposed");
    expect(() => pubAdd({ a: 10, b: 20 })).toThrow("Exec context has been disposed");

    expect(getCachedFunctions(AGENT_ID, DRAFT_VERSION)).toBeUndefined();
    expect(getCachedFunctions(AGENT_ID, PUBLISHED_VERSION)).toBeUndefined();
  });

  it("clearFunctionCache(agentId) 不影响其他 agent 的缓存", async () => {
    // Agent 1
    const { fns: fns1, exec: exec1 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, DRAFT_VERSION, fns1, exec1);

    // Agent 2
    const { fns: fns2, exec: exec2 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID_2, DRAFT_VERSION, fns2, exec2);

    // 清除 agent 1 的所有版本
    clearFunctionCache(AGENT_ID);

    // Agent 1 被清除
    expect(getCachedFunctions(AGENT_ID, DRAFT_VERSION)).toBeUndefined();
    const fn1 = fns1.get("add") as (input: unknown) => unknown;
    expect(() => fn1({ a: 1, b: 2 })).toThrow("Exec context has been disposed");

    // Agent 2 不受影响
    expect(getCachedFunctions(AGENT_ID_2, DRAFT_VERSION)).toBe(fns2);
    const fn2 = fns2.get("add") as (input: unknown) => unknown;
    expect(fn2({ a: 1, b: 2 })).toBe(3);

    exec2.dispose();
  });

  it("clearFunctionCache() 无参清除所有 agent 所有版本", async () => {
    // 两个 agent 各两个版本
    const entries = await Promise.all(
      [
        [AGENT_ID, DRAFT_VERSION],
        [AGENT_ID, PUBLISHED_VERSION],
        [AGENT_ID_2, DRAFT_VERSION],
        [AGENT_ID_2, PUBLISHED_VERSION],
      ].map(async ([aid, vid]) => {
        const { fns, exec } = await resolveAndCompileFunctions(SIMPLE_FN);
        setCachedFunctions(aid, vid, fns, exec);
        return { aid, vid, fns };
      })
    );

    // 全部有缓存
    for (const { aid, vid, fns } of entries) {
      expect(getCachedFunctions(aid, vid)).toBe(fns);
    }

    // 无参清除
    clearFunctionCache();

    // 全部被清除
    for (const { aid, vid, fns } of entries) {
      expect(getCachedFunctions(aid, vid)).toBeUndefined();
      const fn = fns.get("add") as (input: unknown) => unknown;
      expect(() => fn({ a: 1, b: 2 })).toThrow("Exec context has been disposed");
    }
  });
});
