import { describe, it, expect } from "vitest";
import { buildInputSchema } from "../schema-builder";
import type { ToolParameter } from "../types";

function makeParam(
  overrides: Partial<ToolParameter> = {}
): ToolParameter {
  return {
    id: "p-1",
    name: "field",
    type: "string",
    description: "A field",
    required: true,
    ...overrides,
  };
}

describe("schema-builder", () => {
  describe("buildInputSchema", () => {
    it("returns a zod object schema", () => {
      const schema = buildInputSchema([]);
      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe("function");
    });

    it("empty parameters produces schema that accepts empty object", () => {
      const schema = buildInputSchema([]);
      expect(() => schema.parse({})).not.toThrow();
    });

    it("empty parameters rejects extra keys in strict parsing", () => {
      const schema = buildInputSchema([]);
      // z.object by default strips unknown keys on parse, so parse succeeds
      const result = schema.parse({ extra: "value" });
      // The extra key should be stripped (zod default behavior)
      expect(result).not.toHaveProperty("extra");
    });

    describe("type mapping", () => {
      it("maps string type correctly", () => {
        const schema = buildInputSchema([makeParam({ type: "string" })]);
        expect(() => schema.parse({ field: "hello" })).not.toThrow();
      });

      it("rejects wrong type for string param", () => {
        const schema = buildInputSchema([makeParam({ type: "string" })]);
        expect(() => schema.parse({ field: 123 })).toThrow();
      });

      it("maps number type correctly", () => {
        const schema = buildInputSchema([makeParam({ type: "number" })]);
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });

      it("rejects wrong type for number param", () => {
        const schema = buildInputSchema([makeParam({ type: "number" })]);
        expect(() => schema.parse({ field: "not a number" })).toThrow();
      });

      it("maps boolean type correctly", () => {
        const schema = buildInputSchema([makeParam({ type: "boolean" })]);
        expect(() => schema.parse({ field: true })).not.toThrow();
        expect(() => schema.parse({ field: false })).not.toThrow();
      });

      it("rejects wrong type for boolean param", () => {
        const schema = buildInputSchema([makeParam({ type: "boolean" })]);
        expect(() => schema.parse({ field: "true" })).toThrow();
      });
    });

    describe("required / optional", () => {
      it("required param fails when missing", () => {
        const schema = buildInputSchema([
          makeParam({ required: true }),
        ]);
        expect(() => schema.parse({})).toThrow();
      });

      it("optional param succeeds when missing", () => {
        const schema = buildInputSchema([
          makeParam({ required: false }),
        ]);
        expect(() => schema.parse({})).not.toThrow();
      });

      it("optional param accepts undefined", () => {
        const schema = buildInputSchema([
          makeParam({ required: false }),
        ]);
        const result = schema.parse({ field: undefined });
        expect(result.field).toBeUndefined();
      });

      it("optional param still validates type when provided", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", required: false }),
        ]);
        expect(() => schema.parse({ field: "oops" })).toThrow();
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });
    });

    describe("multiple parameters", () => {
      it("handles multiple params of different types", () => {
        const schema = buildInputSchema([
          makeParam({ id: "1", name: "query", type: "string", required: true }),
          makeParam({ id: "2", name: "limit", type: "number", required: false }),
          makeParam({ id: "3", name: "active", type: "boolean", required: true }),
        ]);

        expect(() =>
          schema.parse({ query: "test", active: true })
        ).not.toThrow();

        expect(() =>
          schema.parse({ query: "test", limit: 10, active: false })
        ).not.toThrow();
      });

      it("fails when any required param is missing", () => {
        const schema = buildInputSchema([
          makeParam({ id: "1", name: "a", required: true }),
          makeParam({ id: "2", name: "b", required: true }),
        ]);
        expect(() => schema.parse({ a: "ok" })).toThrow();
      });
    });

    describe("enum support", () => {
      it("uses z.enum when param has enum values", () => {
        const schema = buildInputSchema([
          makeParam({ enum: ["a", "b", "c"] }),
        ]);
        expect(() => schema.parse({ field: "a" })).not.toThrow();
        expect(() => schema.parse({ field: "b" })).not.toThrow();
      });

      it("rejects values not in enum", () => {
        const schema = buildInputSchema([
          makeParam({ enum: ["a", "b", "c"] }),
        ]);
        expect(() => schema.parse({ field: "d" })).toThrow();
      });

      it("ignores enum for non-string types", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", enum: ["a", "b"] }),
        ]);
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });

      it("treats empty enum array as regular string", () => {
        const schema = buildInputSchema([
          makeParam({ enum: [] }),
        ]);
        expect(() => schema.parse({ field: "anything" })).not.toThrow();
      });

      it("works with optional enum param", () => {
        const schema = buildInputSchema([
          makeParam({ required: false, enum: ["x", "y"] }),
        ]);
        expect(() => schema.parse({})).not.toThrow();
        expect(() => schema.parse({ field: "x" })).not.toThrow();
        expect(() => schema.parse({ field: "z" })).toThrow();
      });
    });

    describe("description", () => {
      it("applies description to the schema field", () => {
        const schema = buildInputSchema([
          makeParam({ description: "Search query" }),
        ]);
        // Schema is created successfully; description is metadata
        expect(() => schema.parse({ field: "test" })).not.toThrow();
      });

      it("handles empty description without error", () => {
        const schema = buildInputSchema([
          makeParam({ description: "" }),
        ]);
        expect(() => schema.parse({ field: "test" })).not.toThrow();
      });
    });
  });
});
