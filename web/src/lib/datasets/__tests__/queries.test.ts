import { describe, it, expect, vi } from "vitest";
import {
  extractDeps,
  topoSortDatasets,
  resolveDatasets,
  validateNoCycle,
} from "../queries";

// Mock db / schema (not used by pure functions, but imported at module level)
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  datasets: {
    key: "key",
    name: "name",
    data: "data",
    agentId: "agent_id",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// ── extractDeps ──

describe("extractDeps", () => {
  const known = new Set(["company", "rate", "items", "config", "enabled"]);

  it("extracts {{ var }}", () => {
    expect(extractDeps("Hello {{ company }}", known)).toEqual(["company"]);
  });

  it("extracts {{ var.prop }}", () => {
    expect(extractDeps("Rate: {{config.maxRate}}", known)).toEqual(["config"]);
  });

  it("extracts {% for x in var %}", () => {
    const tpl = "{% for item in items %}{{item.name}}{% endfor %}";
    const deps = extractDeps(tpl, known);
    expect(deps).toContain("items");
    // "item" is an iteration variable, should NOT be included
    expect(deps).not.toContain("item");
  });

  it("extracts {% if var %}", () => {
    expect(extractDeps("{% if enabled %}yes{% endif %}", known)).toEqual([
      "enabled",
    ]);
  });

  it("handles filters like {{ var | upcase }}", () => {
    expect(extractDeps('{{company | upcase}}', known)).toEqual(["company"]);
  });

  it("deduplicates", () => {
    const deps = extractDeps("{{company}} and {{company}}", known);
    expect(deps).toEqual(["company"]);
  });

  it("returns empty for primitives with no templates", () => {
    expect(extractDeps(42, known)).toEqual([]);
    expect(extractDeps(true, known)).toEqual([]);
    expect(extractDeps(null, known)).toEqual([]);
  });

  it("ignores unknown keys", () => {
    expect(extractDeps("{{unknown_var}}", known)).toEqual([]);
  });

  it("ignores Liquid built-in variables", () => {
    expect(extractDeps("{{forloop.index}}", known)).toEqual([]);
  });

  it("extracts from JSON objects (stringified)", () => {
    const data = { label: "{{company}}", value: "{{rate}}" };
    const deps = extractDeps(data, known);
    expect(deps).toContain("company");
    expect(deps).toContain("rate");
  });
});

// ── topoSortDatasets ──

describe("topoSortDatasets", () => {
  it("returns independent datasets in original order", () => {
    const records = [
      { key: "a", data: "hello" },
      { key: "b", data: 42 },
    ];
    const sorted = topoSortDatasets(records);
    expect(sorted.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("sorts dependencies before dependents", () => {
    const records = [
      { key: "derived", data: "Value: {{base}}" },
      { key: "base", data: "raw" },
    ];
    const sorted = topoSortDatasets(records);
    const keys = sorted.map((r) => r.key);
    expect(keys.indexOf("base")).toBeLessThan(keys.indexOf("derived"));
  });

  it("handles multi-level chains", () => {
    const records = [
      { key: "c", data: "{{b}}" },
      { key: "b", data: "{{a}}" },
      { key: "a", data: "root" },
    ];
    const sorted = topoSortDatasets(records);
    const keys = sorted.map((r) => r.key);
    expect(keys.indexOf("a")).toBeLessThan(keys.indexOf("b"));
    expect(keys.indexOf("b")).toBeLessThan(keys.indexOf("c"));
  });

  it("throws on circular dependency", () => {
    const records = [
      { key: "x", data: "{{y}}" },
      { key: "y", data: "{{x}}" },
    ];
    expect(() => topoSortDatasets(records)).toThrow(/Circular dependency/);
  });

  it("throws on self-reference", () => {
    const records = [{ key: "self", data: "{{self}}" }];
    expect(() => topoSortDatasets(records)).toThrow(/Circular dependency/);
  });

  it("throws on indirect cycle (A→B→C→A)", () => {
    const records = [
      { key: "a", data: "{{c}}" },
      { key: "b", data: "{{a}}" },
      { key: "c", data: "{{b}}" },
    ];
    expect(() => topoSortDatasets(records)).toThrow(/Circular dependency/);
  });
});

// ── resolveDatasets ──

describe("resolveDatasets", () => {
  it("resolves independent datasets", () => {
    const { resolvedVars } = resolveDatasets([
      { key: "name", data: "Acme" },
      { key: "count", data: 42 },
    ]);
    expect(resolvedVars.name).toBe("Acme");
    expect(resolvedVars.count).toBe(42);
  });

  it("resolves A→B two-level chain", () => {
    const { resolvedVars } = resolveDatasets([
      { key: "base", data: "Hello" },
      { key: "derived", data: "{{base}} World" },
    ]);
    expect(resolvedVars.derived).toBe("Hello World");
  });

  it("resolves A→B→C three-level chain", () => {
    const { resolvedVars } = resolveDatasets([
      { key: "a", data: "Root" },
      { key: "b", data: "{{a}}-Mid" },
      { key: "c", data: "{{b}}-End" },
    ]);
    expect(resolvedVars.c).toBe("Root-Mid-End");
  });

  it("resolves object data with template references", () => {
    const { resolvedVars } = resolveDatasets([
      { key: "name", data: "Universe" },
      {
        key: "routes",
        data: { product: { label: "{{name}}", states: ["CA"] } },
      },
    ]);
    expect(resolvedVars.routes).toEqual({
      product: { label: "Universe", states: ["CA"] },
    });
  });

  it("builds datasetEntries from arrays", () => {
    const { datasetEntries } = resolveDatasets([
      { key: "langs", data: ["en", "zh"] },
    ]);
    expect(datasetEntries.langs).toEqual([
      { value: "en" },
      { value: "zh" },
    ]);
  });

  it("builds datasetEntries from objects with string values", () => {
    const { datasetEntries } = resolveDatasets([
      { key: "states", data: { CA: "California", TX: "Texas" } },
    ]);
    expect(datasetEntries.states).toEqual([
      { value: "California" },
      { value: "Texas" },
    ]);
  });

  it("builds datasetEntries from objects with non-string values (uses keys)", () => {
    const { datasetEntries } = resolveDatasets([
      {
        key: "products",
        data: {
          universe: { label: "Universe", states: ["CA"] },
        },
      },
    ]);
    expect(datasetEntries.products).toEqual([{ value: "universe" }]);
  });
});

// ── validateNoCycle ──

describe("validateNoCycle", () => {
  it("passes when there are no cycles", () => {
    expect(() =>
      validateNoCycle([
        { key: "a", data: "hello" },
        { key: "b", data: "{{a}}" },
      ])
    ).not.toThrow();
  });

  it("throws on direct cycle", () => {
    expect(() =>
      validateNoCycle([
        { key: "a", data: "{{b}}" },
        { key: "b", data: "{{a}}" },
      ])
    ).toThrow(/Circular dependency/);
  });

  it("throws on indirect cycle", () => {
    expect(() =>
      validateNoCycle([
        { key: "a", data: "{{c}}" },
        { key: "b", data: "{{a}}" },
        { key: "c", data: "{{b}}" },
      ])
    ).toThrow(/Circular dependency/);
  });

  it("throws on self-reference", () => {
    expect(() =>
      validateNoCycle([{ key: "x", data: "{{x}}" }])
    ).toThrow(/Circular dependency/);
  });
});
