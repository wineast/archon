import { describe, it, expect } from "vitest";
import { runAllAssertions } from "@/lib/eval/assertions";
import type { Assertion } from "@/lib/eval/types";
import deepEqual from "fast-deep-equal";

/**
 * Tests for the tool test case assertion judgment logic.
 *
 * The run API uses two checks:
 * 1. expectedOutput != null → deepEqual(result, expectedOutput)
 * 2. assertions.length > 0  → runAllAssertions(assertions, JSON.stringify(result))
 * Both must pass for `passed = true`.
 */

/** Simulate the combined judgment logic used in the run API */
function judgeTestCase(
  result: unknown,
  expectedOutput: unknown | undefined,
  assertions: Assertion[]
) {
  let passed = true;
  if (expectedOutput != null) {
    passed = passed && deepEqual(result, expectedOutput);
  }
  let assertionResults: ReturnType<typeof runAllAssertions> = [];
  if (assertions.length > 0) {
    assertionResults = runAllAssertions(assertions, JSON.stringify(result));
    passed = passed && assertionResults.every((r) => r.passed);
  }
  return { passed, assertionResults };
}

describe("Tool test case — assertion judgment", () => {
  it("passes when no expectedOutput and no assertions", () => {
    const { passed, assertionResults } = judgeTestCase(
      { foo: "bar" },
      undefined,
      []
    );
    expect(passed).toBe(true);
    expect(assertionResults).toEqual([]);
  });

  it("passes with exact expectedOutput match only", () => {
    const result = { products: ["a", "b"] };
    const { passed } = judgeTestCase(result, { products: ["a", "b"] }, []);
    expect(passed).toBe(true);
  });

  it("fails with expectedOutput mismatch", () => {
    const result = { products: ["a", "b"] };
    const { passed } = judgeTestCase(result, { products: ["x"] }, []);
    expect(passed).toBe(false);
  });

  it("passes with assertions only (no expectedOutput)", () => {
    const result = { products: ["universe", "stellar"], exclusive: true };
    const assertions: Assertion[] = [
      { id: "a1", type: "contains", value: "universe" },
      { id: "a2", type: "regex", value: '"exclusive":\\s*true' },
    ];
    const { passed, assertionResults } = judgeTestCase(
      result,
      undefined,
      assertions
    );
    expect(passed).toBe(true);
    expect(assertionResults).toHaveLength(2);
    expect(assertionResults.every((r) => r.passed)).toBe(true);
  });

  it("fails when one assertion fails", () => {
    const result = { products: ["stellar"], exclusive: false };
    const assertions: Assertion[] = [
      { id: "a1", type: "contains", value: "universe" },
      { id: "a2", type: "regex", value: '"exclusive":\\s*true' },
    ];
    const { passed, assertionResults } = judgeTestCase(
      result,
      undefined,
      assertions
    );
    expect(passed).toBe(false);
    expect(assertionResults[0].passed).toBe(false);
    expect(assertionResults[1].passed).toBe(false);
  });

  it("both expectedOutput and assertions must pass together", () => {
    const result = { name: "hello" };
    const assertions: Assertion[] = [
      { id: "a1", type: "contains", value: "hello" },
    ];
    // Exact match passes + assertion passes
    const { passed: p1 } = judgeTestCase(result, { name: "hello" }, assertions);
    expect(p1).toBe(true);

    // Exact match fails but assertion passes → overall fails
    const { passed: p2 } = judgeTestCase(result, { name: "world" }, assertions);
    expect(p2).toBe(false);

    // Exact match passes but assertion fails → overall fails
    const { passed: p3 } = judgeTestCase(
      result,
      { name: "hello" },
      [{ id: "a1", type: "contains", value: "missing" }]
    );
    expect(p3).toBe(false);
  });

  it("supports not-contains assertion", () => {
    const result = { status: "ok" };
    const assertions: Assertion[] = [
      { id: "a1", type: "not-contains", value: "error" },
    ];
    const { passed } = judgeTestCase(result, undefined, assertions);
    expect(passed).toBe(true);
  });

  it("supports json-valid assertion", () => {
    // JSON.stringify(result) is always valid JSON
    const result = { data: [1, 2, 3] };
    const assertions: Assertion[] = [
      { id: "a1", type: "json-valid", value: "" },
    ];
    const { passed } = judgeTestCase(result, undefined, assertions);
    expect(passed).toBe(true);
  });

  it("supports length-min and length-max assertions", () => {
    const result = { longValue: "a".repeat(100) };
    const serialized = JSON.stringify(result);

    const assertions: Assertion[] = [
      { id: "a1", type: "length-min", value: "10" },
      { id: "a2", type: "length-max", value: "500" },
    ];
    const { passed, assertionResults } = judgeTestCase(
      result,
      undefined,
      assertions
    );
    expect(passed).toBe(true);
    expect(assertionResults[0].passed).toBe(true);
    expect(assertionResults[1].passed).toBe(true);

    // Fails if min is too high
    const { passed: p2 } = judgeTestCase(result, undefined, [
      { id: "a1", type: "length-min", value: "99999" },
    ]);
    expect(p2).toBe(false);
  });

  it("supports regex assertion", () => {
    const result = { count: 42, items: ["a"] };
    const assertions: Assertion[] = [
      { id: "a1", type: "regex", value: '"count":\\s*42' },
    ];
    const { passed } = judgeTestCase(result, undefined, assertions);
    expect(passed).toBe(true);
  });

  it("handles invalid regex gracefully", () => {
    const result = { data: "test" };
    const assertions: Assertion[] = [
      { id: "a1", type: "regex", value: "[invalid" },
    ];
    const { passed, assertionResults } = judgeTestCase(
      result,
      undefined,
      assertions
    );
    expect(passed).toBe(false);
    expect(assertionResults[0].passed).toBe(false);
    expect(assertionResults[0].message).toContain("Invalid regex");
  });
});
