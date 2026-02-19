import { describe, it, expect } from "vitest";
import { buildInputSchema } from "../schema-builder";
import type { SchemaProperty } from "../types";

function makeParam(overrides: Partial<SchemaProperty> = {}): SchemaProperty {
  return {
    id: "p-1",
    name: "field",
    type: "string",
    description: "A field",
    required: true,
    ...overrides,
  };
}

describe("schema-builder — enum type", () => {
  describe("type: enum with manual values", () => {
    it("accepts values in enum list", () => {
      const schema = buildInputSchema([
        makeParam({ type: "enum", enum: ["CA", "NY", "TX"] }),
      ]);
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "NY" })).not.toThrow();
    });

    it("rejects values not in enum list", () => {
      const schema = buildInputSchema([
        makeParam({ type: "enum", enum: ["CA", "NY", "TX"] }),
      ]);
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });

    it("falls back to z.string() when enum is empty", () => {
      const schema = buildInputSchema([
        makeParam({ type: "enum", enum: [] }),
      ]);
      expect(() => schema.parse({ field: "anything" })).not.toThrow();
    });

    it("falls back to z.string() when enum is undefined", () => {
      const schema = buildInputSchema([makeParam({ type: "enum" })]);
      expect(() => schema.parse({ field: "anything" })).not.toThrow();
    });

    it("works with optional enum param", () => {
      const schema = buildInputSchema([
        makeParam({ type: "enum", required: false, enum: ["a", "b"] }),
      ]);
      expect(() => schema.parse({})).not.toThrow();
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "c" })).toThrow();
    });
  });

  describe("type: enum with enumRef → resolvedVars (array)", () => {
    const resolvedVars = {
      states: ["CA", "NY", "TX"],
      non_list: "not an array",
    };

    it("resolves enumRef from array in resolvedVars", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "states" })],
        resolvedVars
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });

    it("ignores non-array/non-object resolvedVars and falls back to enum", () => {
      const schema = buildInputSchema(
        [
          makeParam({
            type: "enum",
            enumRef: "non_list",
            enum: ["fallback"],
          }),
        ],
        resolvedVars
      );
      expect(() => schema.parse({ field: "fallback" })).not.toThrow();
    });

    it("falls back to enum when enumRef not found in resolvedVars", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "unknown", enum: ["x", "y"] })],
        resolvedVars
      );
      expect(() => schema.parse({ field: "x" })).not.toThrow();
      expect(() => schema.parse({ field: "z" })).toThrow();
    });
  });

  describe("type: enum with enumRef → resolvedVars (json object)", () => {
    const resolvedVars = {
      income_type: { salary: "Salary", bonus: "Bonus", rental: "Rental Income" },
      states: ["CA", "NY"],
      plain_string: "not an object",
    };

    it("resolves enumRef from object via Object.values() when values are strings", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "income_type" })],
        resolvedVars
      );
      expect(() => schema.parse({ field: "Salary" })).not.toThrow();
      expect(() => schema.parse({ field: "Bonus" })).not.toThrow();
      expect(() => schema.parse({ field: "Rental Income" })).not.toThrow();
      expect(() => schema.parse({ field: "salary" })).toThrow(); // key, not value
    });

    it("resolves enumRef from object via Object.keys() when values are non-strings", () => {
      const vars = { nums: { a: 1, b: 2, c: 3 } };
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "nums" })],
        vars
      );
      // Object.keys() → ["a", "b", "c"]
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "b" })).not.toThrow();
      expect(() => schema.parse({ field: "1" })).toThrow(); // value, not key
    });

    it("ignores non-object/non-array resolvedVars and falls back to enum", () => {
      const schema = buildInputSchema(
        [
          makeParam({
            type: "enum",
            enumRef: "plain_string",
            enum: ["fallback"],
          }),
        ],
        resolvedVars
      );
      expect(() => schema.parse({ field: "fallback" })).not.toThrow();
      expect(() => schema.parse({ field: "not an object" })).toThrow();
    });

    it("arrays still resolve as arrays, not as objects", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "states" })],
        resolvedVars
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });
  });

  describe("string type no longer handles enum", () => {
    it("string type with enum values ignores them (just z.string)", () => {
      const schema = buildInputSchema([
        makeParam({ type: "string", enum: ["a", "b"] }),
      ]);
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      // "c" is accepted because string type doesn't use enum
      expect(() => schema.parse({ field: "c" })).not.toThrow();
    });

    it("string type with enumRef ignores it (just z.string)", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "string", enumRef: "colors" })],
        { colors: ["red", "blue"] }
      );
      expect(() => schema.parse({ field: "red" })).not.toThrow();
      // "green" is accepted because string type doesn't resolve enum
      expect(() => schema.parse({ field: "green" })).not.toThrow();
    });
  });
});
