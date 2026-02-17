import { describe, it, expect } from "vitest";
import { buildInputSchema } from "../schema-builder";
import type { ToolParameter } from "../types";

function makeParam(overrides: Partial<ToolParameter> = {}): ToolParameter {
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

  describe("type: enum with enumRef → activeVars", () => {
    const activeVars = {
      states: ["CA", "NY", "TX"],
      non_list: "not an array",
    };

    it("resolves enumRef from activeVars", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "states" })],
        {},
        activeVars
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });

    it("lookupVars takes priority over activeVars", () => {
      const lookupVars = {
        states: [{ value: "FL" }, { value: "GA" }],
      };
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "states" })],
        lookupVars,
        activeVars
      );
      expect(() => schema.parse({ field: "FL" })).not.toThrow();
      expect(() => schema.parse({ field: "CA" })).toThrow();
    });

    it("ignores non-array activeVars and falls back to enum", () => {
      const schema = buildInputSchema(
        [
          makeParam({
            type: "enum",
            enumRef: "non_list",
            enum: ["fallback"],
          }),
        ],
        {},
        activeVars
      );
      expect(() => schema.parse({ field: "fallback" })).not.toThrow();
    });

    it("falls back to enum when enumRef not found in either source", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "unknown", enum: ["x", "y"] })],
        {},
        activeVars
      );
      expect(() => schema.parse({ field: "x" })).not.toThrow();
      expect(() => schema.parse({ field: "z" })).toThrow();
    });
  });

  describe("type: enum with enumRef → activeVars (json object)", () => {
    const activeVars = {
      income_type: { salary: "Salary", bonus: "Bonus", rental: "Rental Income" },
      states: ["CA", "NY"],
      plain_string: "not an object",
    };

    it("resolves enumRef from a plain object via Object.values()", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "income_type" })],
        {},
        activeVars
      );
      expect(() => schema.parse({ field: "Salary" })).not.toThrow();
      expect(() => schema.parse({ field: "Bonus" })).not.toThrow();
      expect(() => schema.parse({ field: "Rental Income" })).not.toThrow();
      expect(() => schema.parse({ field: "salary" })).toThrow(); // key, not value
    });

    it("converts non-string object values to strings", () => {
      const vars = { nums: { a: 1, b: 2, c: 3 } };
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "nums" })],
        {},
        vars
      );
      expect(() => schema.parse({ field: "1" })).not.toThrow();
      expect(() => schema.parse({ field: "2" })).not.toThrow();
    });

    it("lookupVars takes priority over json object activeVars", () => {
      const lookupVars = {
        income_type: [{ value: "W2" }, { value: "1099" }],
      };
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "income_type" })],
        lookupVars,
        activeVars
      );
      expect(() => schema.parse({ field: "W2" })).not.toThrow();
      expect(() => schema.parse({ field: "Salary" })).toThrow();
    });

    it("ignores non-object/non-array activeVars and falls back to enum", () => {
      const schema = buildInputSchema(
        [
          makeParam({
            type: "enum",
            enumRef: "plain_string",
            enum: ["fallback"],
          }),
        ],
        {},
        activeVars
      );
      expect(() => schema.parse({ field: "fallback" })).not.toThrow();
      expect(() => schema.parse({ field: "not an object" })).toThrow();
    });

    it("arrays still resolve as arrays, not as objects", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumRef: "states" })],
        {},
        activeVars
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });
  });

  describe("backward compat: string type with enum/enumRef still works", () => {
    it("string type with enum values still uses z.enum", () => {
      const schema = buildInputSchema([
        makeParam({ type: "string", enum: ["a", "b"] }),
      ]);
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "c" })).toThrow();
    });

    it("string type with enumRef still resolves from lookupVars", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "string", enumRef: "colors" })],
        { colors: [{ value: "red" }, { value: "blue" }] }
      );
      expect(() => schema.parse({ field: "red" })).not.toThrow();
      expect(() => schema.parse({ field: "green" })).toThrow();
    });
  });
});
