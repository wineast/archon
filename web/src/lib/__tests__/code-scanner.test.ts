import { describe, it, expect } from "vitest";
import { scanCode } from "../code-scanner";

describe("scanCode", () => {
  it("passes clean code", () => {
    const result = scanCode(
      `export default function(input) { return input.a + input.b; }`
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects forbidden global: process", () => {
    const result = scanCode(
      `export default function() { return process.env.SECRET; }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("process"))).toBe(true);
  });

  it("detects forbidden global: globalThis", () => {
    const result = scanCode(
      `export default function() { return globalThis.foo; }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("globalThis"))).toBe(true);
  });

  it("detects forbidden global: Buffer", () => {
    const result = scanCode(
      `export default function() { return Buffer.from("test"); }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Buffer"))).toBe(true);
  });

  it("detects require() call", () => {
    const result = scanCode(
      `export default function() { const fs = require("fs"); }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("require"))).toBe(true);
  });

  it("detects eval() call", () => {
    const result = scanCode(
      `export default function() { return eval("1+1"); }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("eval"))).toBe(true);
  });

  it("detects new Function()", () => {
    const result = scanCode(
      `export default function() { return new Function("return 1")(); }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("new Function"))).toBe(true);
  });

  it("detects setTimeout with string argument", () => {
    const result = scanCode(
      `export default function() { setTimeout("alert(1)", 100); }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("setTimeout"))).toBe(true);
  });

  it("allows setTimeout with function argument", () => {
    const result = scanCode(
      `export default function() { setTimeout(function(){}, 100); }`
    );
    expect(result.ok).toBe(true);
  });

  it("detects non-archon import", () => {
    const result = scanCode(
      `import fs from "fs";\nexport default function() { return fs; }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("fs"))).toBe(true);
  });

  it("allows archon:fn import", () => {
    const result = scanCode(
      `import double from "archon:fn/double";\nexport default function(input) { return double(input); }`
    );
    expect(result.ok).toBe(true);
  });

  it("allows archon:context import", () => {
    const result = scanCode(
      `import { wiki } from "archon:context";\nexport default async function(args) { return await wiki.get("test"); }`
    );
    expect(result.ok).toBe(true);
  });

  it("detects constructor.constructor escape", () => {
    const result = scanCode(
      `export default function() { return "".constructor.constructor("return this")(); }`
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("constructor.constructor"))).toBe(true);
  });

  it("rejects code with syntax errors", () => {
    const result = scanCode(`export default function( { return 1; }`);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("代码解析失败"))).toBe(true);
  });
});
