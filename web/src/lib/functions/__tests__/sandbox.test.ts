import { describe, it, expect } from "vitest";
import {
  compileAndExecFn,
  createFunctionsSandbox,
  SandboxCompilationError,
  SandboxTimeoutError,
  SandboxError,
} from "../sandbox";

describe("compileAndExecFn", () => {
  it("evaluates numeric computation", async () => {
    const code = `function fn() { return function(input) { return input.a + input.b; } }`;
    const result = await compileAndExecFn(code, { a: 10, b: 5 });
    expect(result).toBe(15);
  });

  it("evaluates string computation", async () => {
    const code = `function fn() { return function(input) { return input.greeting + " " + input.name; } }`;
    const result = await compileAndExecFn(code, {
      greeting: "Hello",
      name: "World",
    });
    expect(result).toBe("Hello World");
  });

  it("returns object results", async () => {
    const code = `function fn() { return function(input) { return { sum: input.x + input.y, product: input.x * input.y }; } }`;
    const result = await compileAndExecFn(code, { x: 3, y: 4 });
    expect(result).toEqual({ sum: 7, product: 12 });
  });

  it("returns array results", async () => {
    const code = `function fn() { return function(input) { return input.items.map(function(x) { return x * 2; }); } }`;
    const result = await compileAndExecFn(code, { items: [1, 2, 3] });
    expect(result).toEqual([2, 4, 6]);
  });

  it("injects host dependencies as globals", async () => {
    const double = (x: number) => x * 2;
    const code = `function fn(double) { return function(input) { return double(input.value); } }`;
    const result = await compileAndExecFn(code, { value: 21 }, { double });
    expect(result).toBe(42);
  });

  it("bridges compileExpression from filtrex", async () => {
    const { compileExpression } = await import("filtrex");
    const code = `function fn(compileExpression) {
      var expr = compileExpression("x + y * 2");
      return function(input) { return expr(input); };
    }`;
    const result = await compileAndExecFn(
      code,
      { x: 10, y: 5 },
      { compileExpression }
    );
    expect(result).toBe(20);
  });

  it("handles async functions via executePendingJobs", async () => {
    const code = `function fn() { return async function(input) { return input.value + 1; } }`;
    const result = await compileAndExecFn(code, { value: 41 });
    expect(result).toBe(42);
  });

  it("throws SandboxCompilationError on syntax error", async () => {
    const code = `function fn() { return function(input { return 1; } }`;
    await expect(compileAndExecFn(code, {})).rejects.toThrow(
      SandboxCompilationError
    );
  });

  it("throws SandboxCompilationError when fn is not defined", async () => {
    const code = `var x = 42;`;
    await expect(compileAndExecFn(code, {})).rejects.toThrow(
      SandboxCompilationError
    );
  });

  it("throws SandboxCompilationError when fn() does not return a function", async () => {
    const code = `function fn() { return 42; }`;
    await expect(compileAndExecFn(code, {})).rejects.toThrow(
      SandboxCompilationError
    );
  });

  it("throws SandboxTimeoutError on infinite loop", async () => {
    const code = `function fn() { return function(input) { while(true) {} } }`;
    await expect(
      compileAndExecFn(code, {}, undefined, { timeoutMs: 200 })
    ).rejects.toThrow(SandboxTimeoutError);
  });

  it("throws on excessive memory allocation", async () => {
    const code = `function fn() { return function(input) {
      var arr = [];
      for (var i = 0; i < 100000000; i++) { arr.push(new Array(10000)); }
      return arr.length;
    } }`;
    await expect(
      compileAndExecFn(code, {}, undefined, {
        memoryLimitBytes: 1024 * 1024,
        timeoutMs: 2000,
      })
    ).rejects.toThrow(SandboxError);
  });

  it("cannot access Node.js globals", async () => {
    const code = `function fn() { return function(input) {
      return typeof process;
    } }`;
    const result = await compileAndExecFn(code, {});
    expect(result).toBe("undefined");
  });

  it("cannot access require", async () => {
    const code = `function fn() { return function(input) {
      return typeof require;
    } }`;
    const result = await compileAndExecFn(code, {});
    expect(result).toBe("undefined");
  });
});

describe("createFunctionsSandbox", () => {
  it("compiles and calls a single function", async () => {
    const sandbox = await createFunctionsSandbox([
      {
        key: "add",
        code: `function fn() { return function(input) { return input.a + input.b; } }`,
        depNames: [],
      },
    ]);
    try {
      expect(sandbox.keys).toEqual(["add"]);
      expect(sandbox.call("add", { a: 3, b: 4 })).toBe(7);
    } finally {
      sandbox.dispose();
    }
  });

  it("supports function-to-function dependencies", async () => {
    const sandbox = await createFunctionsSandbox([
      {
        key: "double",
        code: `function fn() { return function(input) { return input.value * 2; } }`,
        depNames: [],
      },
      {
        key: "quadruple",
        code: `function fn(double) { return function(input) { return double({ value: double({ value: input.value }) }); } }`,
        depNames: ["double"],
      },
    ]);
    try {
      expect(sandbox.call("double", { value: 5 })).toBe(10);
      expect(sandbox.call("quadruple", { value: 5 })).toBe(20);
    } finally {
      sandbox.dispose();
    }
  });

  it("injects host deps into shared sandbox", async () => {
    const triple = (x: number) => x * 3;
    const sandbox = await createFunctionsSandbox(
      [
        {
          key: "calc",
          code: `function fn(triple) { return function(input) { return triple(input.value); } }`,
          depNames: ["triple"],
        },
      ],
      { triple }
    );
    try {
      expect(sandbox.call("calc", { value: 7 })).toBe(21);
    } finally {
      sandbox.dispose();
    }
  });

  it("throws after dispose", async () => {
    const sandbox = await createFunctionsSandbox([
      {
        key: "noop",
        code: `function fn() { return function() { return null; } }`,
        depNames: [],
      },
    ]);
    sandbox.dispose();
    expect(() => sandbox.call("noop", {})).toThrow("disposed");
  });

  it("throws for unknown function key", async () => {
    const sandbox = await createFunctionsSandbox([
      {
        key: "a",
        code: `function fn() { return function() { return 1; } }`,
        depNames: [],
      },
    ]);
    try {
      expect(() => sandbox.call("nonexistent", {})).toThrow("not found");
    } finally {
      sandbox.dispose();
    }
  });
});
