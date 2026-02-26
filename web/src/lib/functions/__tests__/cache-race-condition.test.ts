/**
 * 测试 FunctionsExec 缓存竞态条件（Issue: concurrent-functions-exec-race-condition）
 *
 * 验证目标：
 * 1. setCachedFunctions 覆盖缓存时 dispose 旧 exec，导致持有旧 fns 引用的调用方抛错
 * 2. 修复后：并发调用应共享同一编译结果，不发生 dispose 冲突
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

  beforeEach(() => {
    clearFunctionCache();
  });

  it("覆盖缓存后，旧 fns 中的函数调用应抛 'Exec context has been disposed'", async () => {
    // 模拟第一个 ToolContext 编译并写入缓存
    const { fns: fns1, exec: exec1 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, fns1, exec1);

    // 此时 fns1 正常可用
    const addFn1 = fns1.get("add") as (input: unknown) => unknown;
    expect(addFn1({ a: 1, b: 2 })).toBe(3);

    // 模拟第二个 ToolContext 也编译完成并覆盖缓存 → dispose exec1
    const { fns: fns2, exec: exec2 } = await resolveAndCompileFunctions(SIMPLE_FN);
    setCachedFunctions(AGENT_ID, fns2, exec2);

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
      setCachedFunctions(AGENT_ID, fns, exec);
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
    setCachedFunctions(AGENT_ID, fns, exec);

    // 多个调用方同时命中缓存 → 拿到同一个 fns 引用
    const cached1 = getCachedFunctions(AGENT_ID);
    const cached2 = getCachedFunctions(AGENT_ID);
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
