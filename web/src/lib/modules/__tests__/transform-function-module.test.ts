import { describe, it, expect } from "vitest";
import { transformFunctionModule } from "../transform-function-module";

describe("transformFunctionModule", () => {
  it("extracts simple function without imports", () => {
    const result = transformFunctionModule(
      `export default function(input) { return input.a + input.b; }`
    );
    expect(result.depKeys).toEqual([]);
    expect(result.aliases).toEqual({});
    expect(result.libAliases).toEqual({});
    expect(result.preamble.trim()).toBe("");
    expect(result.fnExpression).toContain("function");
    expect(result.fnExpression).toContain("return input.a + input.b");
  });

  it("extracts archon:fn imports", () => {
    const code = `import double from "archon:fn/double";
export default function(input) { return double(input); }`;
    const result = transformFunctionModule(code);
    expect(result.depKeys).toEqual(["double"]);
    expect(result.aliases).toEqual({ double: "double" });
  });

  it("extracts multiple imports", () => {
    const code = `import add from "archon:fn/add";
import multiply from "archon:fn/multiply";
export default function(input) { return add(input) + multiply(input); }`;
    const result = transformFunctionModule(code);
    expect(result.depKeys).toEqual(["add", "multiply"]);
    expect(result.aliases).toEqual({ add: "add", multiply: "multiply" });
  });

  it("supports aliased imports", () => {
    const code = `import myDouble from "archon:fn/double";
export default function(input) { return myDouble(input); }`;
    const result = transformFunctionModule(code);
    expect(result.depKeys).toEqual(["double"]);
    expect(result.aliases).toEqual({ myDouble: "double" });
  });

  it("throws on unsupported module import", () => {
    const code = `import fs from "fs";
export default function() { return fs; }`;
    expect(() => transformFunctionModule(code)).toThrow("不支持模块");
  });

  it("throws when no default export", () => {
    const code = `var x = 42;`;
    expect(() => transformFunctionModule(code)).toThrow("export default");
  });

  it("supports async function", () => {
    const code = `export default async function(input) { return await input.promise; }`;
    const result = transformFunctionModule(code);
    expect(result.fnExpression).toContain("async");
  });

  it("preserves preamble code (var declarations before export)", () => {
    const code = `var multiplier = 2;
export default function(input) { return input.value * multiplier; }`;
    const result = transformFunctionModule(code);
    expect(result.preamble).toContain("var multiplier = 2;");
    expect(result.fnExpression).toContain("input.value * multiplier");
  });

  it("preserves helper functions in preamble", () => {
    const code = `function helper(x) { return x * 2; }
export default function(input) { return helper(input.value); }`;
    const result = transformFunctionModule(code);
    expect(result.preamble).toContain("helper");
    expect(result.fnExpression).toContain("helper(input.value)");
  });

  it("extracts archon:lib imports into libAliases", () => {
    const code = `import compileExpression from "archon:lib/compileExpression";
export default function(input) { return compileExpression(input.expression); }`;
    const result = transformFunctionModule(code);
    expect(result.depKeys).toEqual([]);
    expect(result.aliases).toEqual({});
    expect(result.libAliases).toEqual({ compileExpression: "compileExpression" });
  });

  it("handles mixed archon:fn and archon:lib imports", () => {
    const code = `import compileExpression from "archon:lib/compileExpression";
import helper from "archon:fn/helper";
export default function(input) { return helper(compileExpression(input.expr)); }`;
    const result = transformFunctionModule(code);
    expect(result.depKeys).toEqual(["helper"]);
    expect(result.aliases).toEqual({ helper: "helper" });
    expect(result.libAliases).toEqual({ compileExpression: "compileExpression" });
  });

  it("throws on unsupported module with updated error message", () => {
    const code = `import fs from "fs";
export default function() { return fs; }`;
    expect(() => transformFunctionModule(code)).toThrow("archon:lib/<key>");
  });
});
