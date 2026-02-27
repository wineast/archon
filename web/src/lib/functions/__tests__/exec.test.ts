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

  it("resolves archon:lib import from deps in one-shot mode", async () => {
    const { compileExpression } = await import("filtrex");
    const code = `import compileExpression from "archon:lib/compileExpression";
export default function(input) {
  var expr = compileExpression(input.expression);
  return expr(input.data);
}`;
    const result = await compileAndExecFn(
      code,
      { expression: "x + y * 2", data: { x: 10, y: 5 } },
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

  it("archon:fn resolves to compiled function only, not host dep", async () => {
    // With namespace isolation, archon:fn/ only resolves to compiled functions.
    // A compiled "wrapper" function is available via archon:fn/.
    const rawDep = (x: number) => x * 2;
    const exec = await createFunctionsExec(
      [
        {
          key: "wrapper",
          code: `export default function(input) { return input.value + 100; }`,
        },
        {
          // consumer imports wrapper via archon:fn/ — gets compiled function
          key: "consumer",
          code: `import wrapper from "archon:fn/wrapper";
export default function(input) { return wrapper({ value: input.n }); }`,
        },
      ],
      { wrapper: rawDep } // host dep with same key — should NOT be resolved by archon:fn/
    );
    try {
      // consumer calls the compiled wrapper (value + 100), NOT the host dep (x * 2)
      const result = exec.call("consumer", { n: 5 });
      expect(result).toBe(105);
    } finally {
      exec.dispose();
    }
  });

  it("archon:lib resolves to host dep for any function", async () => {
    const { compileExpression } = await import("filtrex");
    const exec = await createFunctionsExec(
      [
        {
          key: "compileExpression",
          code: `import compileExpression from "archon:lib/compileExpression";
export default function(input) {
  var expr = compileExpression(input.expression);
  return expr(input.data);
}`,
        },
      ],
      { compileExpression },
    );
    try {
      const result = exec.call("compileExpression", {
        expression: "x + y * 2",
        data: { x: 10, y: 5 },
      });
      expect(result).toBe(20);
    } finally {
      exec.dispose();
    }
  });

  it("user function can use archon:lib to access host dep", async () => {
    const myLib = (x: number) => x * 3;
    const exec = await createFunctionsExec(
      [
        {
          key: "user_fn",
          code: `import myLib from "archon:lib/myLib";
export default function(input) { return myLib(input.value); }`,
        },
      ],
      { myLib },
    );
    try {
      expect(exec.call("user_fn", { value: 7 })).toBe(21);
    } finally {
      exec.dispose();
    }
  });

  it("builtin + user function coexist: builtin uses lib, user uses fn", async () => {
    const { compileExpression } = await import("filtrex");

    const exec = await createFunctionsExec(
      [
        {
          // Builtin wrapper uses archon:lib/ to access raw filtrex
          key: "compileExpression",
          code: `import compileExpression from "archon:lib/compileExpression";
export default function(input) {
  var expr = compileExpression(input.expression);
  return expr(input.data);
}`,
        },
        {
          // User function uses archon:fn/ to access the compiled wrapper
          key: "pricing_engine",
          code: `import compileExpression from "archon:fn/compileExpression";
export default function(input) {
  return compileExpression({ expression: input.formula, data: input.vars });
}`,
        },
      ],
      { compileExpression },
    );
    try {
      // pricing_engine calls wrapper which calls raw filtrex
      const result = exec.call("pricing_engine", {
        formula: "x + y * 2",
        vars: { x: 10, y: 5 },
      });
      expect(result).toBe(20);
    } finally {
      exec.dispose();
    }
  });

  it("user function directly uses archon:lib (no builtin wrapper needed)", async () => {
    // Verifies that user functions can bypass the builtin wrapper and use lib directly
    const { compileExpression } = await import("filtrex");
    const exec = await createFunctionsExec(
      [
        {
          key: "my_calculator",
          code: `import compileExpression from "archon:lib/compileExpression";
export default function(input) {
  var expr = compileExpression(input.expr);
  return { result: expr(input.vars) };
}`,
        },
      ],
      { compileExpression },
    );
    try {
      const result = exec.call("my_calculator", {
        expr: "a * b + c",
        vars: { a: 2, b: 3, c: 10 },
      });
      expect(result).toEqual({ result: 16 });
    } finally {
      exec.dispose();
    }
  });

  it("multiple user functions each using archon:lib independently", async () => {
    const toUpper = (s: string) => s.toUpperCase();
    const reverse = (s: string) => s.split("").reverse().join("");
    const exec = await createFunctionsExec(
      [
        {
          key: "shout",
          code: `import toUpper from "archon:lib/toUpper";
export default function(input) { return toUpper(input.text); }`,
        },
        {
          key: "flip",
          code: `import reverse from "archon:lib/reverse";
export default function(input) { return reverse(input.text); }`,
        },
      ],
      { toUpper, reverse },
    );
    try {
      expect(exec.call("shout", { text: "hello" })).toBe("HELLO");
      expect(exec.call("flip", { text: "hello" })).toBe("olleh");
    } finally {
      exec.dispose();
    }
  });

  it("archon:lib and archon:fn can be used together in one function", async () => {
    const multiply = (a: number, b: number) => a * b;
    const exec = await createFunctionsExec(
      [
        {
          key: "add_ten",
          code: `export default function(input) { return input.value + 10; }`,
        },
        {
          key: "combo",
          code: `import multiply from "archon:lib/multiply";
import add_ten from "archon:fn/add_ten";
export default function(input) {
  var product = multiply(input.a, input.b);
  return add_ten({ value: product });
}`,
        },
      ],
      { multiply },
    );
    try {
      // multiply(3, 4) = 12, add_ten(12) = 22
      expect(exec.call("combo", { a: 3, b: 4 })).toBe(22);
    } finally {
      exec.dispose();
    }
  });

  it("archon:lib import for non-existent dep is silently ignored (returns undefined)", async () => {
    const exec = await createFunctionsExec(
      [
        {
          key: "try_missing",
          code: `import missing from "archon:lib/nonExistent";
export default function(input) { return typeof missing; }`,
        },
      ],
      { someOtherDep: 42 }, // nonExistent is not in deps
    );
    try {
      expect(exec.call("try_missing", {})).toBe("undefined");
    } finally {
      exec.dispose();
    }
  });
});
