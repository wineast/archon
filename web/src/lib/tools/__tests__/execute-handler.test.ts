import { describe, it, expect } from "vitest";
import { executeToolHandler } from "../execute-handler";
import type { ToolContext } from "../tool-context";

// Minimal mock ToolContext for testing
function mockContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    wiki: {
      get: async () => null,
      findByPrefix: async () => [],
      search: async () => [],
    },
    dataset: {
      get: async () => null,
    },
    fn: async () => (() => null),
    ontology: {
      types: async () => [],
      type: async () => null,
      query: async () => [],
      get: async () => null,
      create: async () => ({ id: "", label: "" }),
      update: async () => ({ id: "", label: "" }),
      delete: async () => ({ ok: true }),
      link: async () => ({ id: "" }),
      unlink: async () => ({ ok: true }),
      graph: async () => ({ nodes: [], edges: [] }),
    },
    ...overrides,
  };
}

describe("executeToolHandler", () => {
  it("executes a simple handler", async () => {
    const code = `export default function(args) { return { doubled: args.x * 2 }; }`;
    const result = await executeToolHandler(code, { x: 21 }, mockContext());
    expect(result).toEqual({ doubled: 42 });
  });

  it("executes a handler with archon:context import", async () => {
    const ctx = mockContext({
      dataset: { get: async (key: string) => (key === "rate" ? 0.1 : null) },
    });
    const code = `import { dataset } from "archon:context";
export default async function(args) {
  const rate = await dataset.get("rate");
  return { total: args.amount * (1 + rate) };
}`;
    const result = await executeToolHandler(code, { amount: 100 }, ctx) as { total: number };
    expect(result.total).toBeCloseTo(110);
  });

  it("executes a handler with archon:lib import", async () => {
    // This test verifies that tool handlers can use archon:lib/ to access host deps.
    // compileExpression from filtrex is in ALL_BASE_DEPS.
    const code = `import compileExpression from "archon:lib/compileExpression";
export default function(args) {
  const expr = compileExpression(args.formula);
  return expr(args.data);
}`;
    const result = await executeToolHandler(
      code,
      { formula: "x + y * 2", data: { x: 10, y: 5 } },
      mockContext(),
    );
    expect(result).toBe(20);
  });

  it("executes a handler with both archon:context and archon:lib", async () => {
    const ctx = mockContext({
      dataset: { get: async (key: string) => (key === "formula" ? "price * qty" : null) },
    });
    const code = `import { dataset } from "archon:context";
import compileExpression from "archon:lib/compileExpression";

export default async function(args) {
  const formula = await dataset.get("formula");
  const expr = compileExpression(formula);
  return { result: expr(args) };
}`;
    const result = await executeToolHandler(
      code,
      { price: 10, qty: 5 },
      ctx,
    );
    expect(result).toEqual({ result: 50 });
  });

  it("rejects handler using process global", async () => {
    const code = `export default function(args) { return process.env.SECRET; }`;
    await expect(
      executeToolHandler(code, {}, mockContext())
    ).rejects.toThrow("Code scan failed");
  });

  it("throws on unsupported archon:fn import in handler", async () => {
    const code = `import calc from "archon:fn/calc";
export default function(args) { return calc(args); }`;
    await expect(
      executeToolHandler(code, {}, mockContext())
    ).rejects.toThrow('不支持模块 "archon:fn/calc"');
  });
});
