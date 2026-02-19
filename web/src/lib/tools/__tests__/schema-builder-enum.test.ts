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

  describe("type: enum with enumDatasetId → datasetsById (array)", () => {
    const datasetsById = {
      "ds-1": ["CA", "NY", "TX"],
    };

    it("resolves enumDatasetId from array in datasetsById", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumDatasetId: "ds-1" })],
        { datasetsById }
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });

    it("falls back to enum when enumDatasetId not found in datasetsById", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumDatasetId: "ds-unknown", enum: ["x", "y"] })],
        { datasetsById }
      );
      expect(() => schema.parse({ field: "x" })).not.toThrow();
      expect(() => schema.parse({ field: "z" })).toThrow();
    });
  });

  describe("type: enum with enumDatasetId → datasetsById (json object)", () => {
    const datasetsById = {
      "ds-income": { salary: "Salary", bonus: "Bonus", rental: "Rental Income" },
      "ds-states": ["CA", "NY"],
    };

    it("resolves enumDatasetId from object via Object.values() when values are strings", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumDatasetId: "ds-income" })],
        { datasetsById }
      );
      expect(() => schema.parse({ field: "Salary" })).not.toThrow();
      expect(() => schema.parse({ field: "Bonus" })).not.toThrow();
      expect(() => schema.parse({ field: "Rental Income" })).not.toThrow();
      expect(() => schema.parse({ field: "salary" })).toThrow(); // key, not value
    });

    it("resolves enumDatasetId from object via Object.keys() when values are non-strings", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumDatasetId: "ds-nums" })],
        { datasetsById: { "ds-nums": { a: 1, b: 2, c: 3 } } }
      );
      // Object.keys() → ["a", "b", "c"]
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "b" })).not.toThrow();
      expect(() => schema.parse({ field: "1" })).toThrow(); // value, not key
    });

    it("arrays still resolve as arrays, not as objects", () => {
      const schema = buildInputSchema(
        [makeParam({ type: "enum", enumDatasetId: "ds-states" })],
        { datasetsById }
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });
  });

  describe("backward compat: string type with enum still works", () => {
    it("string type with enum values still uses z.enum", () => {
      const schema = buildInputSchema([
        makeParam({ type: "string", enum: ["a", "b"] }),
      ]);
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "c" })).toThrow();
    });
  });
});
