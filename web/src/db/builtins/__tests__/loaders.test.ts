import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mock buildAllTools for tools loader ── */

const mockBuildAllTools = vi.fn();
vi.mock("@/lib/build-chat/tools", () => ({
  buildAllTools: (...args: unknown[]) => mockBuildAllTools(...args),
}));

import {
  loadBuiltinToolDefs,
  loadBuiltinFunctionDefs,
  loadBuiltinComponentDefs,
  loadBuiltinWikiManifest,
  GUIDE_DIR,
} from "../index";

describe("loadBuiltinToolDefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one BuiltinToolDef per tool from buildAllTools", () => {
    mockBuildAllTools.mockReturnValue({
      tool_a: { description: "Tool A" },
      tool_b: { description: "Tool B" },
    });

    const defs = loadBuiltinToolDefs();
    expect(defs).toHaveLength(2);
    expect(defs[0]).toMatchObject({
      key: "tool_a",
      name: "tool_a",
      description: "Tool A",
      parametersSchema: null,
    });
    expect(defs[1]).toMatchObject({
      key: "tool_b",
      name: "tool_b",
      description: "Tool B",
      parametersSchema: null,
    });
  });

  it("returns empty array when buildAllTools returns empty", () => {
    mockBuildAllTools.mockReturnValue({});
    expect(loadBuiltinToolDefs()).toHaveLength(0);
  });
});

describe("loadBuiltinFunctionDefs", () => {
  it("returns an array of function definitions with required fields", () => {
    const defs = loadBuiltinFunctionDefs();
    expect(defs.length).toBeGreaterThanOrEqual(1);
    for (const def of defs) {
      expect(def).toHaveProperty("key");
      expect(def).toHaveProperty("name");
      expect(def).toHaveProperty("code");
      expect(def).toHaveProperty("parametersSchema");
      expect(def).toHaveProperty("testCases");
    }
  });

  it("contains compileExpression", () => {
    const defs = loadBuiltinFunctionDefs();
    const ce = defs.find((d) => d.key === "compileExpression");
    expect(ce).toBeDefined();
    expect(ce!.testCases.length).toBeGreaterThan(0);
  });
});

describe("loadBuiltinComponentDefs", () => {
  it("returns an array of component definitions with required fields", () => {
    const defs = loadBuiltinComponentDefs();
    expect(defs.length).toBeGreaterThanOrEqual(4);
    for (const def of defs) {
      expect(def).toHaveProperty("key");
      expect(def).toHaveProperty("name");
      expect(def).toHaveProperty("description");
    }
  });

  it("includes badge, spinner, table, tooltip", () => {
    const defs = loadBuiltinComponentDefs();
    const keys = defs.map((d) => d.key);
    expect(keys).toContain("badge");
    expect(keys).toContain("spinner");
    expect(keys).toContain("table");
    expect(keys).toContain("tooltip");
  });
});

describe("loadBuiltinWikiManifest", () => {
  it("returns an array of wiki entries with key, name, file", () => {
    const entries = loadBuiltinWikiManifest();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry).toHaveProperty("key");
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("file");
      expect(entry.file).toMatch(/\.md$/);
    }
  });
});

describe("GUIDE_DIR", () => {
  it("is an absolute path ending with /guide", () => {
    expect(GUIDE_DIR).toMatch(/\/guide$/);
  });
});
