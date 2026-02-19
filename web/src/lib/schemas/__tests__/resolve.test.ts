import { describe, it, expect } from "vitest";
import {
  resolveParameters,
  detectCycle,
  getReachableSchemaIds,
} from "../resolve";
import type { SchemaRow } from "@/db/schema";

function makeSchema(
  overrides: Partial<SchemaRow> & { id: string; name: string }
): SchemaRow {
  return {
    agentId: "agent-1",
    key: overrides.name.toLowerCase().replace(/\s/g, "_"),
    description: "",
    parameters: [],
    includeSchemaIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function param(name: string, type = "string" as const) {
  return { id: name, name, type, description: "", required: false };
}

describe("resolveParameters", () => {
  it("returns own fields when no includes", () => {
    const schema = makeSchema({
      id: "s1",
      name: "S1",
      parameters: [param("a"), param("b")],
    });
    const map = new Map([["s1", schema]]);
    const result = resolveParameters(schema, map);
    expect(result).toHaveLength(2);
    expect(result[0]._source).toBe("own");
  });

  it("merges include fields before own fields", () => {
    const base = makeSchema({
      id: "base",
      name: "Base",
      parameters: [param("x"), param("y")],
    });
    const child = makeSchema({
      id: "child",
      name: "Child",
      includeSchemaIds: ["base"],
      parameters: [param("y"), param("z")],
    });
    const map = new Map([
      ["base", base],
      ["child", child],
    ]);
    const result = resolveParameters(child, map);
    expect(result.map((r) => r.name)).toEqual(["x", "y", "z"]);
    // x from base, y overridden by own, z own
    expect(result.find((r) => r.name === "x")?._source).toBe("Base");
    expect(result.find((r) => r.name === "y")?._source).toBe("own");
    expect(result.find((r) => r.name === "z")?._source).toBe("own");
  });

  it("later includes override earlier includes", () => {
    const a = makeSchema({
      id: "a",
      name: "A",
      parameters: [param("x")],
    });
    const b = makeSchema({
      id: "b",
      name: "B",
      parameters: [param("x")],
    });
    const child = makeSchema({
      id: "child",
      name: "Child",
      includeSchemaIds: ["a", "b"],
      parameters: [],
    });
    const map = new Map([
      ["a", a],
      ["b", b],
      ["child", child],
    ]);
    const result = resolveParameters(child, map);
    expect(result).toHaveLength(1);
    expect(result[0]._source).toBe("B");
  });

  it("handles circular references gracefully", () => {
    const a = makeSchema({
      id: "a",
      name: "A",
      includeSchemaIds: ["b"],
      parameters: [param("x")],
    });
    const b = makeSchema({
      id: "b",
      name: "B",
      includeSchemaIds: ["a"],
      parameters: [param("y")],
    });
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);
    // Should not throw
    const result = resolveParameters(a, map);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("detectCycle", () => {
  it("detects self-reference", () => {
    const s = makeSchema({ id: "s1", name: "S1" });
    const map = new Map([["s1", s]]);
    expect(detectCycle("s1", ["s1"], map)).toBe(true);
  });

  it("detects indirect cycle", () => {
    const a = makeSchema({ id: "a", name: "A", includeSchemaIds: ["b"] });
    const b = makeSchema({ id: "b", name: "B" });
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);
    // Adding "a" as include to "b" would create b→a→b cycle
    expect(detectCycle("b", ["a"], map)).toBe(true);
  });

  it("allows non-cyclic includes", () => {
    const a = makeSchema({ id: "a", name: "A" });
    const b = makeSchema({ id: "b", name: "B" });
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);
    expect(detectCycle("a", ["b"], map)).toBe(false);
  });
});

describe("getReachableSchemaIds", () => {
  it("returns self and transitive includes", () => {
    const a = makeSchema({ id: "a", name: "A", includeSchemaIds: ["b"] });
    const b = makeSchema({ id: "b", name: "B", includeSchemaIds: ["c"] });
    const c = makeSchema({ id: "c", name: "C" });
    const map = new Map([
      ["a", a],
      ["b", b],
      ["c", c],
    ]);
    const reachable = getReachableSchemaIds("a", map);
    expect(reachable).toEqual(new Set(["a", "b", "c"]));
  });
});
