import { describe, it, expect } from "vitest";
import { transformToolHandlerImports } from "../transform-tool-handler";

describe("transformToolHandlerImports", () => {
  it("transforms archon:context named imports", () => {
    const code = `import { wiki, dataset } from "archon:context";
export default async function(args) {
  return await wiki.get(args.id);
}`;
    const result = transformToolHandlerImports(code);
    expect(result).toContain("var wiki = __context.wiki;");
    expect(result).toContain("var dataset = __context.dataset;");
    expect(result).not.toContain("import");
    expect(result).not.toContain("export default");
  });

  it("transforms archon:lib/filtrex named imports", () => {
    const code = `import { compileExpression } from "archon:lib/filtrex";
export default function(args) {
  const expr = compileExpression("x + y");
  return expr(args);
}`;
    const result = transformToolHandlerImports(code);
    expect(result).toContain("var compileExpression = __libs.compileExpression;");
    expect(result).not.toContain("import");
    expect(result).not.toContain("export default");
  });

  it("transforms both archon:context and archon:lib/filtrex imports", () => {
    const code = `import { dataset } from "archon:context";
import { compileExpression } from "archon:lib/filtrex";
export default async function(args) {
  const data = await dataset.get(args.key);
  const expr = compileExpression(args.filter);
  return expr(data);
}`;
    const result = transformToolHandlerImports(code);
    expect(result).toContain("var dataset = __context.dataset;");
    expect(result).toContain("var compileExpression = __libs.compileExpression;");
  });

  it("throws on unsupported archon:fn import", () => {
    const code = `import calc from "archon:fn/pricing_engine";
export default async function(args) {
  return calc(args);
}`;
    expect(() => transformToolHandlerImports(code)).toThrow(
      '工具 Handler 不支持模块 "archon:fn/pricing_engine"'
    );
    expect(() => transformToolHandlerImports(code)).toThrow(
      'archon:lib/filtrex'
    );
  });

  it("throws on unsupported module import", () => {
    const code = `import React from "archon:react";
export default function(args) { return args; }`;
    expect(() => transformToolHandlerImports(code)).toThrow(
      '工具 Handler 不支持模块 "archon:react"'
    );
    expect(() => transformToolHandlerImports(code)).toThrow(
      'archon:lib/filtrex'
    );
  });

  it("wraps in an IIFE", () => {
    const code = `export default function(args) { return args.x * 2; }`;
    const result = transformToolHandlerImports(code);
    expect(result).toMatch(/^\(function\(\)\{/);
    expect(result).toMatch(/\}\)\(\)$/);
  });

  it("returns the handler result via IIFE", () => {
    const code = `export default function(args) { return args.x; }`;
    const result = transformToolHandlerImports(code);
    expect(result).toContain("return (__handler__)(__args, __context);");
  });

  it("handles export default arrow expression", () => {
    const code = `export default (args) => args.x * 2;`;
    const result = transformToolHandlerImports(code);
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
    const result = transformToolHandlerImports(code);
    expect(result).toContain("function helper(x) { return x * 2; }");
    expect(result).toContain("var wiki = __context.wiki;");
  });
});
