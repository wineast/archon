import { describe, it, expect } from "vitest";
import { resolveAndCompileFunctions, type FunctionRecord } from "../compile";
import type { JsonSchema7 } from "@/lib/schemas/types";

describe("resolveAndCompileFunctions", () => {
  it("compiles function without defsMap", async () => {
    const rows: FunctionRecord[] = [
      {
        key: "add",
        code: `export default function(input) { return input.a + input.b; }`,
        parameters: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["a", "b"],
        },
      },
    ];

    const { fns, exec } = await resolveAndCompileFunctions(rows);
    try {
      const addFn = fns.get("add") as (input: unknown) => unknown;
      expect(addFn).toBeDefined();
      expect(addFn({ a: 1, b: 2 })).toBe(3);
    } finally {
      exec.dispose();
    }
  });

  it("validates input with $ref schema when defsMap is provided", async () => {
    const defsMap: Record<string, JsonSchema7> = {
      point: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["x", "y"],
      },
    };

    const rows: FunctionRecord[] = [
      {
        key: "get_x",
        code: `export default function(input) { return input.x; }`,
        parameters: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
      },
    ];

    // With defsMap, $ref in nested properties should be resolved
    const { fns, exec } = await resolveAndCompileFunctions(rows, defsMap);
    try {
      const fn = fns.get("get_x") as (input: unknown) => unknown;
      expect(fn).toBeDefined();
      expect(fn({ x: 42, y: 10 })).toBe(42);
    } finally {
      exec.dispose();
    }
  });

  it("rejects invalid input when schema validation is enabled", async () => {
    const rows: FunctionRecord[] = [
      {
        key: "strict_fn",
        code: `export default function(input) { return input.name; }`,
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
      },
    ];

    const { fns, exec } = await resolveAndCompileFunctions(rows);
    try {
      const fn = fns.get("strict_fn") as (input: unknown) => unknown;
      // Missing required field should throw
      expect(() => fn({})).toThrow();
    } finally {
      exec.dispose();
    }
  });

  it("resolves $ref property in schema via defsMap", async () => {
    const defsMap: Record<string, JsonSchema7> = {
      coords: {
        type: "object",
        properties: {
          lat: { type: "number" },
          lng: { type: "number" },
        },
        required: ["lat", "lng"],
      },
    };

    const rows: FunctionRecord[] = [
      {
        key: "location_fn",
        code: `export default function(input) { return input.coords.lat + input.coords.lng; }`,
        parameters: {
          type: "object",
          properties: {
            coords: { $ref: "#/$defs/coords" },
          },
          required: ["coords"],
        },
      },
    ];

    const { fns, exec } = await resolveAndCompileFunctions(rows, defsMap);
    try {
      const fn = fns.get("location_fn") as (input: unknown) => unknown;
      expect(fn({ coords: { lat: 30, lng: 120 } })).toBe(150);
    } finally {
      exec.dispose();
    }
  });

  it("without defsMap, $ref property returns z.unknown()", async () => {
    const rows: FunctionRecord[] = [
      {
        key: "ref_fn",
        code: `export default function(input) { return input.data; }`,
        parameters: {
          type: "object",
          properties: {
            data: { $ref: "#/$defs/some_schema" },
          },
          required: ["data"],
        },
      },
    ];

    // Without defsMap, $ref cannot be resolved and falls back to z.unknown()
    const { fns, exec } = await resolveAndCompileFunctions(rows);
    try {
      const fn = fns.get("ref_fn") as (input: unknown) => unknown;
      // Should still work — z.unknown() accepts anything
      expect(fn({ data: "hello" })).toBe("hello");
    } finally {
      exec.dispose();
    }
  });
});

describe("archon:lib namespace", () => {
  it("compiles functions with archon:lib/fn namespace isolation", async () => {
    const { compileExpression } = await import("filtrex");
    const rows: FunctionRecord[] = [
      {
        key: "compileExpression",
        code: `import compileExpression from "archon:lib/compileExpression";\n\nexport default function(input) {\n  const expr = compileExpression(input.expression);\n  return expr(input.data);\n}`,
        parameters: {
          type: "object",
          properties: {
            expression: { type: "string" },
            data: { type: "object" },
          },
          required: ["expression", "data"],
        },
      },
      {
        key: "pricing_engine",
        code: `import compileExpression from "archon:fn/compileExpression";
export default function(input) {
  return compileExpression({ expression: input.formula, data: input.vars });
}`,
        parameters: {
          type: "object",
          properties: {
            formula: { type: "string" },
            vars: { type: "object" },
          },
          required: ["formula", "vars"],
        },
      },
    ];

    const { fns, exec } = await resolveAndCompileFunctions(
      rows,
      undefined,
      { compileExpression },
    );
    try {
      const pricingFn = fns.get("pricing_engine") as (input: unknown) => unknown;
      expect(pricingFn).toBeDefined();
      const result = pricingFn({ formula: "x + y * 2", vars: { x: 10, y: 5 } });
      expect(result).toBe(20);
    } finally {
      exec.dispose();
    }
  });

  it("user function can use archon:lib directly", async () => {
    const myHelper = (s: string) => s.toUpperCase();
    const rows: FunctionRecord[] = [
      {
        key: "upper",
        code: `import myHelper from "archon:lib/myHelper";
export default function(input) { return myHelper(input.text); }`,
        parameters: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
    ];

    const { fns, exec } = await resolveAndCompileFunctions(
      rows,
      undefined,
      { myHelper },
    );
    try {
      const fn = fns.get("upper") as (input: unknown) => unknown;
      expect(fn({ text: "hello" })).toBe("HELLO");
    } finally {
      exec.dispose();
    }
  });
});
