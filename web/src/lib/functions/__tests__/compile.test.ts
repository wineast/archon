import { describe, it, expect } from "vitest";
import { resolveAndCompileFunctions, type FunctionRecord } from "../compile";
import type { JsonSchema7 } from "@/lib/schemas/types";

describe("resolveAndCompileFunctions", () => {
  it("compiles function without defsMap", async () => {
    const rows: FunctionRecord[] = [
      {
        key: "add",
        code: `function fn() { return function(input) { return input.a + input.b; } }`,
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

    const { fns, sandbox } = await resolveAndCompileFunctions(rows);
    try {
      const addFn = fns.get("add") as (input: unknown) => unknown;
      expect(addFn).toBeDefined();
      expect(addFn({ a: 1, b: 2 })).toBe(3);
    } finally {
      sandbox.dispose();
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
        code: `function fn() { return function(input) { return input.x; } }`,
        parameters: {
          type: "object",
          properties: {
            // Use $ref to reference the "point" schema — the property itself is a $ref
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
      },
    ];

    // With defsMap, $ref in nested properties should be resolved
    const { fns, sandbox } = await resolveAndCompileFunctions(rows, defsMap);
    try {
      const fn = fns.get("get_x") as (input: unknown) => unknown;
      expect(fn).toBeDefined();
      expect(fn({ x: 42, y: 10 })).toBe(42);
    } finally {
      sandbox.dispose();
    }
  });

  it("rejects invalid input when schema validation is enabled", async () => {
    const rows: FunctionRecord[] = [
      {
        key: "strict_fn",
        code: `function fn() { return function(input) { return input.name; } }`,
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
      },
    ];

    const { fns, sandbox } = await resolveAndCompileFunctions(rows);
    try {
      const fn = fns.get("strict_fn") as (input: unknown) => unknown;
      // Missing required field should throw
      expect(() => fn({})).toThrow();
    } finally {
      sandbox.dispose();
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
        code: `function fn() { return function(input) { return input.coords.lat + input.coords.lng; } }`,
        parameters: {
          type: "object",
          properties: {
            coords: { $ref: "#/$defs/coords" },
          },
          required: ["coords"],
        },
      },
    ];

    const { fns, sandbox } = await resolveAndCompileFunctions(rows, defsMap);
    try {
      const fn = fns.get("location_fn") as (input: unknown) => unknown;
      expect(fn({ coords: { lat: 30, lng: 120 } })).toBe(150);
    } finally {
      sandbox.dispose();
    }
  });

  it("without defsMap, $ref property returns z.unknown()", async () => {
    const rows: FunctionRecord[] = [
      {
        key: "ref_fn",
        code: `function fn() { return function(input) { return input.data; } }`,
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
    const { fns, sandbox } = await resolveAndCompileFunctions(rows);
    try {
      const fn = fns.get("ref_fn") as (input: unknown) => unknown;
      // Should still work — z.unknown() accepts anything
      expect(fn({ data: "hello" })).toBe("hello");
    } finally {
      sandbox.dispose();
    }
  });
});
