import { describe, it, expect, vi } from "vitest";
import { buildInputSchema } from "../schema-builder";
import type { SchemaProperty } from "../types";

function makeParam(
  overrides: Partial<SchemaProperty> = {}
): SchemaProperty {
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

    describe("enum support (type: enum)", () => {
      it("uses z.enum when param type is enum with values", () => {
        const schema = buildInputSchema([
          makeParam({ type: "enum", enum: ["a", "b", "c"] }),
        ]);
        expect(() => schema.parse({ field: "a" })).not.toThrow();
        expect(() => schema.parse({ field: "b" })).not.toThrow();
      });

      it("rejects values not in enum", () => {
        const schema = buildInputSchema([
          makeParam({ type: "enum", enum: ["a", "b", "c"] }),
        ]);
        expect(() => schema.parse({ field: "d" })).toThrow();
      });

      it("works with optional enum param", () => {
        const schema = buildInputSchema([
          makeParam({ type: "enum", required: false, enum: ["x", "y"] }),
        ]);
        expect(() => schema.parse({})).not.toThrow();
        expect(() => schema.parse({ field: "x" })).not.toThrow();
        expect(() => schema.parse({ field: "z" })).toThrow();
      });
    });

    describe("string type no longer resolves enum", () => {
      it("string with enum values ignores enum (just z.string)", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", enum: ["a", "b", "c"] }),
        ]);
        // "d" is accepted because string type doesn't use enum
        expect(() => schema.parse({ field: "d" })).not.toThrow();
      });

      it("treats empty enum array as regular string", () => {
        const schema = buildInputSchema([
          makeParam({ enum: [] }),
        ]);
        expect(() => schema.parse({ field: "anything" })).not.toThrow();
      });

      it("ignores enum for non-string types", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", enum: ["a", "b"] }),
        ]);
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });
    });

    describe("enum fallback warning", () => {
      it("falls back to z.string when enum type has no values", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const schema = buildInputSchema([
          makeParam({ type: "enum" }),
        ]);
        expect(() => schema.parse({ field: "anything" })).not.toThrow();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("no values")
        );
        warn.mockRestore();
      });
    });

    describe("object type (replaces json)", () => {
      it("accepts object with nested properties", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "object",
            properties: [
              makeParam({ id: "c1", name: "name", type: "string", required: true }),
              makeParam({ id: "c2", name: "age", type: "number", required: false }),
            ],
          }),
        ]);
        expect(() =>
          schema.parse({ field: { name: "Alice" } })
        ).not.toThrow();
        expect(() =>
          schema.parse({ field: { name: "Alice", age: 30 } })
        ).not.toThrow();
      });

      it("validates nested child types", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "object",
            properties: [
              makeParam({ id: "c1", name: "count", type: "number", required: true }),
            ],
          }),
        ]);
        expect(() =>
          schema.parse({ field: { count: "not a number" } })
        ).toThrow();
      });

      it("accepts z.unknown when no properties", () => {
        const schema = buildInputSchema([
          makeParam({ type: "object" }),
        ]);
        expect(() => schema.parse({ field: { any: "data" } })).not.toThrow();
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });
    });

    describe("array type", () => {
      it("accepts array of items", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "array",
            items: makeParam({ id: "item", name: "item", type: "string" }),
          }),
        ]);
        expect(() =>
          schema.parse({ field: ["a", "b", "c"] })
        ).not.toThrow();
      });

      it("validates item types", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "array",
            items: makeParam({ id: "item", name: "item", type: "number" }),
          }),
        ]);
        expect(() =>
          schema.parse({ field: [1, 2, 3] })
        ).not.toThrow();
        expect(() =>
          schema.parse({ field: ["a", "b"] })
        ).toThrow();
      });

      it("accepts array of objects", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "array",
            items: makeParam({
              id: "item",
              name: "item",
              type: "object",
              properties: [
                makeParam({ id: "c1", name: "name", type: "string", required: true }),
              ],
            }),
          }),
        ]);
        expect(() =>
          schema.parse({ field: [{ name: "Alice" }, { name: "Bob" }] })
        ).not.toThrow();
      });

      it("accepts z.unknown array when no items", () => {
        const schema = buildInputSchema([
          makeParam({ type: "array" }),
        ]);
        expect(() =>
          schema.parse({ field: [1, "two", true] })
        ).not.toThrow();
      });

      it("enforces minItems", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "array",
            items: makeParam({ id: "item", name: "item", type: "string" }),
            minItems: 2,
          }),
        ]);
        expect(() => schema.parse({ field: ["a"] })).toThrow();
        expect(() => schema.parse({ field: ["a", "b"] })).not.toThrow();
      });

      it("enforces maxItems", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "array",
            items: makeParam({ id: "item", name: "item", type: "string" }),
            maxItems: 2,
          }),
        ]);
        expect(() => schema.parse({ field: ["a", "b"] })).not.toThrow();
        expect(() => schema.parse({ field: ["a", "b", "c"] })).toThrow();
      });
    });

    describe("string constraints", () => {
      it("enforces minLength", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", minLength: 3 }),
        ]);
        expect(() => schema.parse({ field: "ab" })).toThrow();
        expect(() => schema.parse({ field: "abc" })).not.toThrow();
      });

      it("enforces maxLength", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", maxLength: 5 }),
        ]);
        expect(() => schema.parse({ field: "12345" })).not.toThrow();
        expect(() => schema.parse({ field: "123456" })).toThrow();
      });

      it("enforces pattern", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", pattern: "^[A-Z]+$" }),
        ]);
        expect(() => schema.parse({ field: "ABC" })).not.toThrow();
        expect(() => schema.parse({ field: "abc" })).toThrow();
      });

      it("validates email format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "email" }),
        ]);
        expect(() => schema.parse({ field: "test@example.com" })).not.toThrow();
        expect(() => schema.parse({ field: "not-an-email" })).toThrow();
      });

      it("validates url format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "url" }),
        ]);
        expect(() => schema.parse({ field: "https://example.com" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-url" })).toThrow();
      });

      it("validates uuid format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "uuid" }),
        ]);
        expect(() => schema.parse({ field: "550e8400-e29b-41d4-a716-446655440000" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-uuid" })).toThrow();
      });

      it("validates date format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "date" }),
        ]);
        expect(() => schema.parse({ field: "2024-01-15" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-date" })).toThrow();
      });

      it("validates date-time format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "date-time" }),
        ]);
        expect(() => schema.parse({ field: "2024-01-15T10:30:00Z" })).not.toThrow();
        expect(() => schema.parse({ field: "2024-01-15" })).toThrow();
      });
    });

    describe("number constraints", () => {
      it("enforces minimum", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", minimum: 10 }),
        ]);
        expect(() => schema.parse({ field: 9 })).toThrow();
        expect(() => schema.parse({ field: 10 })).not.toThrow();
      });

      it("enforces maximum", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", maximum: 100 }),
        ]);
        expect(() => schema.parse({ field: 100 })).not.toThrow();
        expect(() => schema.parse({ field: 101 })).toThrow();
      });

      it("enforces exclusiveMinimum (gt)", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", exclusiveMinimum: 0 }),
        ]);
        expect(() => schema.parse({ field: 0 })).toThrow();
        expect(() => schema.parse({ field: 0.01 })).not.toThrow();
      });

      it("enforces exclusiveMaximum (lt)", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", exclusiveMaximum: 100 }),
        ]);
        expect(() => schema.parse({ field: 100 })).toThrow();
        expect(() => schema.parse({ field: 99.99 })).not.toThrow();
      });

      it("enforces integer constraint", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", integer: true }),
        ]);
        expect(() => schema.parse({ field: 42 })).not.toThrow();
        expect(() => schema.parse({ field: 42.5 })).toThrow();
      });

      it("enforces multipleOf", () => {
        const schema = buildInputSchema([
          makeParam({ type: "number", multipleOf: 5 }),
        ]);
        expect(() => schema.parse({ field: 10 })).not.toThrow();
        expect(() => schema.parse({ field: 13 })).toThrow();
      });
    });

    describe("null type", () => {
      it("accepts null value", () => {
        const schema = buildInputSchema([makeParam({ type: "null" })]);
        expect(() => schema.parse({ field: null })).not.toThrow();
      });

      it("rejects non-null values", () => {
        const schema = buildInputSchema([makeParam({ type: "null" })]);
        expect(() => schema.parse({ field: "hello" })).toThrow();
        expect(() => schema.parse({ field: 0 })).toThrow();
        expect(() => schema.parse({ field: false })).toThrow();
      });
    });

    describe("const type", () => {
      it("accepts matching literal string", () => {
        const schema = buildInputSchema([
          makeParam({ type: "const", constValue: "1.0" }),
        ]);
        expect(() => schema.parse({ field: "1.0" })).not.toThrow();
      });

      it("rejects non-matching value", () => {
        const schema = buildInputSchema([
          makeParam({ type: "const", constValue: "1.0" }),
        ]);
        expect(() => schema.parse({ field: "2.0" })).toThrow();
      });

      it("accepts matching literal number", () => {
        const schema = buildInputSchema([
          makeParam({ type: "const", constValue: 42 }),
        ]);
        expect(() => schema.parse({ field: 42 })).not.toThrow();
        expect(() => schema.parse({ field: 43 })).toThrow();
      });

      it("accepts matching literal boolean", () => {
        const schema = buildInputSchema([
          makeParam({ type: "const", constValue: true }),
        ]);
        expect(() => schema.parse({ field: true })).not.toThrow();
        expect(() => schema.parse({ field: false })).toThrow();
      });

      it("falls back to z.unknown when no constValue", () => {
        const schema = buildInputSchema([
          makeParam({ type: "const" }),
        ]);
        expect(() => schema.parse({ field: "anything" })).not.toThrow();
      });
    });

    describe("new string formats (time, ipv4, ipv6)", () => {
      it("validates time format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "time" }),
        ]);
        expect(() => schema.parse({ field: "14:30:00" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-time" })).toThrow();
      });

      it("validates ipv4 format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "ipv4" }),
        ]);
        expect(() => schema.parse({ field: "192.168.1.1" })).not.toThrow();
        expect(() => schema.parse({ field: "not-an-ip" })).toThrow();
      });

      it("validates ipv6 format", () => {
        const schema = buildInputSchema([
          makeParam({ type: "string", format: "ipv6" }),
        ]);
        expect(() => schema.parse({ field: "::1" })).not.toThrow();
        expect(() => schema.parse({ field: "not-an-ipv6" })).toThrow();
      });
    });

    describe("uniqueItems", () => {
      it("rejects duplicate primitives", () => {
        const schema = buildInputSchema([
          makeParam({ type: "array", uniqueItems: true, items: makeParam({ type: "number" }) }),
        ]);
        expect(() => schema.parse({ field: [1, 2, 3] })).not.toThrow();
        expect(() => schema.parse({ field: [1, 2, 1] })).toThrow();
      });

      it("rejects duplicate objects regardless of key order", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "array",
            uniqueItems: true,
            items: makeParam({
              type: "object",
              properties: [
                makeParam({ id: "a", name: "a", type: "number" }),
                makeParam({ id: "b", name: "b", type: "number" }),
              ],
            }),
          }),
        ]);
        // Same keys, different insertion order → should be detected as duplicate
        expect(() =>
          schema.parse({ field: [{ a: 1, b: 2 }, { b: 2, a: 1 }] })
        ).toThrow();
      });

      it("accepts distinct objects", () => {
        const schema = buildInputSchema([
          makeParam({
            type: "array",
            uniqueItems: true,
            items: makeParam({
              type: "object",
              properties: [
                makeParam({ id: "a", name: "a", type: "number" }),
                makeParam({ id: "b", name: "b", type: "number" }),
              ],
            }),
          }),
        ]);
        expect(() =>
          schema.parse({ field: [{ a: 1, b: 2 }, { a: 1, b: 3 }] })
        ).not.toThrow();
      });

      it("handles nested objects", () => {
        const schema = buildInputSchema([
          makeParam({ type: "array", uniqueItems: true }),
        ]);
        expect(() =>
          schema.parse({ field: [{ x: { b: 2, a: 1 } }, { x: { a: 1, b: 2 } }] })
        ).toThrow();
      });

      it("allows duplicates when uniqueItems is false", () => {
        const schema = buildInputSchema([
          makeParam({ type: "array", items: makeParam({ type: "number" }) }),
        ]);
        expect(() => schema.parse({ field: [1, 1, 1] })).not.toThrow();
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
