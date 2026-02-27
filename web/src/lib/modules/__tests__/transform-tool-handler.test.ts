import { describe, it, expect } from "vitest";
import { transformToolHandlerImports } from "../transform-tool-handler";

describe("transformToolHandlerImports", () => {
  it("transforms archon:context named imports", () => {
    const code = `import { wiki, dataset } from "archon:context";
export default async function(args) {
  return await wiki.get(args.id);
}`;
    const { code: result, libKeys } = transformToolHandlerImports(code);
    expect(result).toContain("var wiki = __context.wiki;");
    expect(result).toContain("var dataset = __context.dataset;");
    expect(result).not.toContain("import");
    expect(result).not.toContain("export default");
    expect(libKeys).toEqual([]);
  });

  it("transforms archon:lib default imports", () => {
    const code = `import compileExpression from "archon:lib/compileExpression";
export default function(args) {
  const expr = compileExpression(args.expression);
  return expr(args.data);
}`;
    const { code: result, libKeys } = transformToolHandlerImports(code);
    expect(result).toContain('var compileExpression = __libs["compileExpression"];');
    expect(result).not.toContain("import");
    expect(libKeys).toEqual(["compileExpression"]);
  });

  it("transforms mixed archon:context + archon:lib imports", () => {
    const code = `import { wiki, fn } from "archon:context";
import compileExpression from "archon:lib/compileExpression";

export default async function(args) {
  const doc = await wiki.get(args.docId);
  const expr = compileExpression(args.formula);
  return expr(doc.meta);
}`;
    const { code: result, libKeys } = transformToolHandlerImports(code);
    expect(result).toContain("var wiki = __context.wiki;");
    expect(result).toContain("var fn = __context.fn;");
    expect(result).toContain('var compileExpression = __libs["compileExpression"];');
    expect(libKeys).toEqual(["compileExpression"]);
  });

  it("throws on unsupported archon:fn import", () => {
    const code = `import calc from "archon:fn/pricing_engine";
export default async function(args) {
  return calc(args);
}`;
    expect(() => transformToolHandlerImports(code)).toThrow(
      '工具 Handler 不支持模块 "archon:fn/pricing_engine"'
    );
  });

  it("throws on unsupported module import", () => {
    const code = `import React from "archon:react";
export default function(args) { return args; }`;
    expect(() => transformToolHandlerImports(code)).toThrow(
      '工具 Handler 不支持模块 "archon:react"'
    );
  });

  it("wraps in an IIFE", () => {
    const code = `export default function(args) { return args.x * 2; }`;
    const { code: result } = transformToolHandlerImports(code);
    expect(result).toMatch(/^\(function\(\)\{/);
    expect(result).toMatch(/\}\)\(\)$/);
  });

  it("returns the handler result via IIFE", () => {
    const code = `export default function(args) { return args.x; }`;
    const { code: result } = transformToolHandlerImports(code);
    expect(result).toContain("return (__handler__)(__args, __context);");
  });

  it("handles export default arrow expression", () => {
    const code = `export default (args) => args.x * 2;`;
    const { code: result } = transformToolHandlerImports(code);
    expect(result).toContain("(args) => args.x * 2");
    expect(result).toContain("return (");
  });

  it("preserves helper code between imports and export", () => {
    const code = `import { wiki } from "archon:context";

function helper(x) { return x * 2; }

export default async function(args) {
  const doc = await wiki.get(args.id);
  return helper(doc);
}`;
    const { code: result } = transformToolHandlerImports(code);
    expect(result).toContain("function helper(x) { return x * 2; }");
    expect(result).toContain("var wiki = __context.wiki;");
  });

  it("collects multiple lib keys", () => {
    const code = `import compileExpression from "archon:lib/compileExpression";
import myHelper from "archon:lib/myHelper";
export default function(args) { return compileExpression(args.x); }`;
    const { libKeys } = transformToolHandlerImports(code);
    expect(libKeys).toEqual(["compileExpression", "myHelper"]);
  });

  it("returns empty libKeys when no lib imports", () => {
    const code = `import { wiki } from "archon:context";
export default async function(args) { return await wiki.get(args.id); }`;
    const { libKeys } = transformToolHandlerImports(code);
    expect(libKeys).toEqual([]);
  });
});
