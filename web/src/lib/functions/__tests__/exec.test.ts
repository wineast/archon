import { describe, it, expect } from "vitest";
import {
  compileAndExecFn,
  createFunctionsExec,
  CompilationError,
  ExecError,
} from "../exec";

describe("compileAndExecFn", () => {
  it("evaluates numeric computation", async () => {
    const code = `export default function(input) { return input.a + input.b; }`;
    const result = await compileAndExecFn(code, { a: 10, b: 5 });
    expect(result).toBe(15);
  });

  it("evaluates string computation", async () => {
    const code = `export default function(input) { return input.greeting + " " + input.name; }`;
    const result = await compileAndExecFn(code, {
      greeting: "Hello",
      name: "World",
    });
    expect(result).toBe("Hello World");
  });

  it("returns object results", async () => {
    const code = `export default function(input) { return { sum: input.x + input.y, product: input.x * input.y }; }`;
    const result = await compileAndExecFn(code, { x: 3, y: 4 });
    expect(result).toEqual({ sum: 7, product: 12 });
  });

  it("returns array results", async () => {
    const code = `export default function(input) { return input.items.map(function(x) { return x * 2; }); }`;
    const result = await compileAndExecFn(code, { items: [1, 2, 3] });
    expect(result).toEqual([2, 4, 6]);
  });

  it("injects host dependencies as globals", async () => {
    const double = (x: number) => x * 2;
    const code = `export default function(input) { return double(input.value); }`;
    const result = await compileAndExecFn(code, { value: 21 }, { double });
    expect(result).toBe(42);
  });

  it("uses compileExpression injected as global dep", async () => {
    const { compileExpression } = await import("filtrex");
    const code = `var expr = compileExpression("x + y * 2");
export default function(input) { return expr(input); }`;
    const result = await compileAndExecFn(
      code,
      { x: 10, y: 5 },
      { compileExpression }
    );
    expect(result).toBe(20);
  });

  it("handles async functions", async () => {
    const code = `export default async function(input) { return input.value + 1; }`;
    const result = await compileAndExecFn(code, { value: 41 });
    expect(result).toBe(42);
  });

  it("throws CompilationError when no default export", async () => {
    const code = `var x = 42;`;
    await expect(compileAndExecFn(code, {})).rejects.toThrow(
      CompilationError
    );
  });

  it("rejects code using process global", async () => {
    const code = `export default function(input) {
      return process.env.SECRET;
    }`;
    await expect(compileAndExecFn(code, {})).rejects.toThrow(
      CompilationError
    );
  });

  it("rejects code using require", async () => {
    const code = `export default function(input) {
      const fs = require("fs");
      return fs;
    }`;
    await expect(compileAndExecFn(code, {})).rejects.toThrow(
      CompilationError
    );
  });
});

describe("createFunctionsExec", () => {
  it("compiles and calls a single function", async () => {
    const exec = await createFunctionsExec([
      {
        key: "add",
        code: `export default function(input) { return input.a + input.b; }`,
      },
    ]);
    try {
      expect(exec.keys).toEqual(["add"]);
      expect(exec.call("add", { a: 3, b: 4 })).toBe(7);
    } finally {
      exec.dispose();
    }
  });

  it("supports function-to-function dependencies via import", async () => {
    const exec = await createFunctionsExec([
      {
        key: "double",
        code: `export default function(input) { return input.value * 2; }`,
      },
      {
        key: "quadruple",
        code: `import double from "archon:fn/double";
export default function(input) { return double({ value: double({ value: input.value }) }); }`,
      },
    ]);
    try {
      expect(exec.call("double", { value: 5 })).toBe(10);
      expect(exec.call("quadruple", { value: 5 })).toBe(20);
    } finally {
      exec.dispose();
    }
  });

  it("injects host deps into shared exec context", async () => {
    const triple = (x: number) => x * 3;
    const exec = await createFunctionsExec(
      [
        {
          key: "calc",
          code: `export default function(input) { return triple(input.value); }`,
        },
      ],
      { triple }
    );
    try {
      expect(exec.call("calc", { value: 7 })).toBe(21);
    } finally {
      exec.dispose();
    }
  });

  it("throws after dispose", async () => {
    const exec = await createFunctionsExec([
      {
        key: "noop",
        code: `export default function() { return null; }`,
      },
    ]);
    exec.dispose();
    expect(() => exec.call("noop", {})).toThrow("disposed");
  });

  it("throws for unknown function key", async () => {
    const exec = await createFunctionsExec([
      {
        key: "a",
        code: `export default function() { return 1; }`,
      },
    ]);
    try {
      expect(() => exec.call("nonexistent", {})).toThrow("not found");
    } finally {
      exec.dispose();
    }
  });

  it("uses compileExpression injected as global dep in shared exec context", async () => {
    const { compileExpression } = await import("filtrex");
    const exec = await createFunctionsExec(
      [
        {
          key: "evaluate",
          code: `var expr = compileExpression("x + y * 2");
export default function(input) { return expr(input); }`,
        },
      ],
      { compileExpression }
    );
    try {
      expect(exec.call("evaluate", { x: 10, y: 5 })).toBe(20);
    } finally {
      exec.dispose();
    }
  });

  it("throws when module has no default export function", async () => {
    await expect(
      createFunctionsExec([
        {
          key: "bad",
          code: `export default 42;`,
        },
      ])
    ).rejects.toThrow(CompilationError);
  });
});
