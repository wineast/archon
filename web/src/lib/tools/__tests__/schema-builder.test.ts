import { describe, it, expect } from "vitest";
import { buildInputSchema } from "../schema-builder";
import type { JsonSchema7 } from "@/lib/schemas/types";

/** Helper: wrap properties + required into a root object schema. */
function makeSchema(
  props: Record<string, JsonSchema7>,
  required?: string[]
): JsonSchema7 {
  return {
    type: "object",
    properties: props,
    required: required ?? Object.keys(props),
  };
}

describe("schema-builder", () => {
  describe("buildInputSchema", () => {
    it("returns a zod object schema", () => {
      const schema = buildInputSchema({ type: "object", properties: {}, required: [] });
      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe("function");
    });

    it("empty properties produces schema that accepts empty object", () => {
      const schema = buildInputSchema({ type: "object", properties: {}, required: [] });
      expect(() => schema.parse({})).not.toThrow();
    });

    it("empty properties rejects extra keys in strict parsing", () => {
      const schema = buildInputSchema({ type: "object", properties: {}, required: [] });
      // z.object by default strips unknown keys on parse, so parse succeeds
      const result = schema.parse({ extra: "value" });
      // The extra key should be stripped (zod default behavior)
      expect(result).not.toHaveProperty("extra");
    });

    describe("type mapping", () => {
      it("maps string type correctly", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "string" } }));
        expect(() => schema.parse({ field: "hello" })).not.toThrow();
      });

      it("rejects wrong type for string param", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "string" } }));
        expect(() => schema.parse({ field: 123 })).toThrow();
      });

      it("maps number type correctly", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "number" } }));
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });

      it("rejects wrong type for number param", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "number" } }));
        expect(() => schema.parse({ field: "not a number" })).toThrow();
      });

      it("maps boolean type correctly", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "boolean" } }));
        expect(() => schema.parse({ field: true })).not.toThrow();
        expect(() => schema.parse({ field: false })).not.toThrow();
      });

      it("rejects wrong type for boolean param", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "boolean" } }));
        expect(() => schema.parse({ field: "true" })).toThrow();
      });
    });

    describe("required / optional", () => {
      it("required param fails when missing", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "string" } }, ["field"]));
        expect(() => schema.parse({})).toThrow();
      });

      it("optional param succeeds when missing", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "string" } }, []));
        expect(() => schema.parse({})).not.toThrow();
      });

      it("optional param accepts undefined", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "string" } }, []));
        const result = schema.parse({ field: undefined });
        expect(result.field).toBeUndefined();
      });

      it("optional param still validates type when provided", () => {
        const schema = buildInputSchema(makeSchema({ field: { type: "number" } }, []));
        expect(() => schema.parse({ field: "oops" })).toThrow();
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });
    });

    describe("multiple parameters", () => {
      it("handles multiple params of different types", () => {
        const schema = buildInputSchema(
          makeSchema(
            {
              query: { type: "string" },
              limit: { type: "number" },
              active: { type: "boolean" },
            },
            ["query", "active"]
          )
        );

        expect(() =>
          schema.parse({ query: "test", active: true })
        ).not.toThrow();

        expect(() =>
          schema.parse({ query: "test", limit: 10, active: false })
        ).not.toThrow();
      });

      it("fails when any required param is missing", () => {
        const schema = buildInputSchema(
          makeSchema(
            {
              a: { type: "string" },
              b: { type: "string" },
            },
            ["a", "b"]
          )
        );
        expect(() => schema.parse({ a: "ok" })).toThrow();
      });
    });

    describe("enum support", () => {
      it("uses z.enum when enum values are present", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", enum: ["a", "b", "c"] } })
        );
        expect(() => schema.parse({ field: "a" })).not.toThrow();
        expect(() => schema.parse({ field: "b" })).not.toThrow();
      });

      it("rejects values not in enum", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", enum: ["a", "b", "c"] } })
        );
        expect(() => schema.parse({ field: "d" })).toThrow();
      });

      it("works with optional enum param", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", enum: ["x", "y"] } }, [])
        );
        expect(() => schema.parse({})).not.toThrow();
        expect(() => schema.parse({ field: "x" })).not.toThrow();
        expect(() => schema.parse({ field: "z" })).toThrow();
      });

      it("falls back to z.string when enum array is empty", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", enum: [] } })
        );
        // Empty enum falls through to string type
        expect(() => schema.parse({ field: "anything" })).not.toThrow();
      });

      it("enum takes precedence over type", () => {
        // In JSON Schema 7, { type: "string", enum: ["a","b"] } has enum checked first
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", enum: ["a", "b"] } })
        );
        expect(() => schema.parse({ field: "a" })).not.toThrow();
        expect(() => schema.parse({ field: "c" })).toThrow();
      });
    });

    describe("object type", () => {
      it("accepts object with nested properties", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
              },
              required: ["name"],
            },
          })
        );
        expect(() =>
          schema.parse({ field: { name: "Alice" } })
        ).not.toThrow();
        expect(() =>
          schema.parse({ field: { name: "Alice", age: 30 } })
        ).not.toThrow();
      });

      it("validates nested child types", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "object",
              properties: {
                count: { type: "number" },
              },
              required: ["count"],
            },
          })
        );
        expect(() =>
          schema.parse({ field: { count: "not a number" } })
        ).toThrow();
      });

      it("accepts z.unknown when no properties", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "object" } })
        );
        expect(() => schema.parse({ field: { any: "data" } })).not.toThrow();
        expect(() => schema.parse({ field: 42 })).not.toThrow();
      });
    });

    describe("array type", () => {
      it("accepts array of items", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "array",
              items: { type: "string" },
            },
          })
        );
        expect(() =>
          schema.parse({ field: ["a", "b", "c"] })
        ).not.toThrow();
      });

      it("validates item types", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "array",
              items: { type: "number" },
            },
          })
        );
        expect(() =>
          schema.parse({ field: [1, 2, 3] })
        ).not.toThrow();
        expect(() =>
          schema.parse({ field: ["a", "b"] })
        ).toThrow();
      });

      it("accepts array of objects", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
                required: ["name"],
              },
            },
          })
        );
        expect(() =>
          schema.parse({ field: [{ name: "Alice" }, { name: "Bob" }] })
        ).not.toThrow();
      });

      it("accepts z.unknown array when no items", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "array" } })
        );
        expect(() =>
          schema.parse({ field: [1, "two", true] })
        ).not.toThrow();
      });

      it("enforces minItems", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
            },
          })
        );
        expect(() => schema.parse({ field: ["a"] })).toThrow();
        expect(() => schema.parse({ field: ["a", "b"] })).not.toThrow();
      });

      it("enforces maxItems", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "array",
              items: { type: "string" },
              maxItems: 2,
            },
          })
        );
        expect(() => schema.parse({ field: ["a", "b"] })).not.toThrow();
        expect(() => schema.parse({ field: ["a", "b", "c"] })).toThrow();
      });
    });

    describe("string constraints", () => {
      it("enforces minLength", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", minLength: 3 } })
        );
        expect(() => schema.parse({ field: "ab" })).toThrow();
        expect(() => schema.parse({ field: "abc" })).not.toThrow();
      });

      it("enforces maxLength", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", maxLength: 5 } })
        );
        expect(() => schema.parse({ field: "12345" })).not.toThrow();
        expect(() => schema.parse({ field: "123456" })).toThrow();
      });

      it("enforces pattern", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", pattern: "^[A-Z]+$" } })
        );
        expect(() => schema.parse({ field: "ABC" })).not.toThrow();
        expect(() => schema.parse({ field: "abc" })).toThrow();
      });

      it("validates email format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "email" } })
        );
        expect(() => schema.parse({ field: "test@example.com" })).not.toThrow();
        expect(() => schema.parse({ field: "not-an-email" })).toThrow();
      });

      it("validates url format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "url" } })
        );
        expect(() => schema.parse({ field: "https://example.com" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-url" })).toThrow();
      });

      it("validates uuid format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "uuid" } })
        );
        expect(() => schema.parse({ field: "550e8400-e29b-41d4-a716-446655440000" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-uuid" })).toThrow();
      });

      it("validates date format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "date" } })
        );
        expect(() => schema.parse({ field: "2024-01-15" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-date" })).toThrow();
      });

      it("validates date-time format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "date-time" } })
        );
        expect(() => schema.parse({ field: "2024-01-15T10:30:00Z" })).not.toThrow();
        expect(() => schema.parse({ field: "2024-01-15" })).toThrow();
      });
    });

    describe("number constraints", () => {
      it("enforces minimum", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "number", minimum: 10 } })
        );
        expect(() => schema.parse({ field: 9 })).toThrow();
        expect(() => schema.parse({ field: 10 })).not.toThrow();
      });

      it("enforces maximum", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "number", maximum: 100 } })
        );
        expect(() => schema.parse({ field: 100 })).not.toThrow();
        expect(() => schema.parse({ field: 101 })).toThrow();
      });

      it("enforces exclusiveMinimum (gt)", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "number", exclusiveMinimum: 0 } })
        );
        expect(() => schema.parse({ field: 0 })).toThrow();
        expect(() => schema.parse({ field: 0.01 })).not.toThrow();
      });

      it("enforces exclusiveMaximum (lt)", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "number", exclusiveMaximum: 100 } })
        );
        expect(() => schema.parse({ field: 100 })).toThrow();
        expect(() => schema.parse({ field: 99.99 })).not.toThrow();
      });

      it("enforces integer constraint", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "integer" } })
        );
        expect(() => schema.parse({ field: 42 })).not.toThrow();
        expect(() => schema.parse({ field: 42.5 })).toThrow();
      });

      it("enforces multipleOf", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "number", multipleOf: 5 } })
        );
        expect(() => schema.parse({ field: 10 })).not.toThrow();
        expect(() => schema.parse({ field: 13 })).toThrow();
      });
    });

    describe("null type", () => {
      it("accepts null value", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "null" } })
        );
        expect(() => schema.parse({ field: null })).not.toThrow();
      });

      it("rejects non-null values", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "null" } })
        );
        expect(() => schema.parse({ field: "hello" })).toThrow();
        expect(() => schema.parse({ field: 0 })).toThrow();
        expect(() => schema.parse({ field: false })).toThrow();
      });
    });

    describe("const type", () => {
      it("accepts matching literal string", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { const: "1.0" } })
        );
        expect(() => schema.parse({ field: "1.0" })).not.toThrow();
      });

      it("rejects non-matching value", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { const: "1.0" } })
        );
        expect(() => schema.parse({ field: "2.0" })).toThrow();
      });

      it("accepts matching literal number", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { const: 42 } })
        );
        expect(() => schema.parse({ field: 42 })).not.toThrow();
        expect(() => schema.parse({ field: 43 })).toThrow();
      });

      it("accepts matching literal boolean", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { const: true } })
        );
        expect(() => schema.parse({ field: true })).not.toThrow();
        expect(() => schema.parse({ field: false })).toThrow();
      });

      it("plain string when no const", () => {
        // Without const, { type: "string" } is just a string
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string" } })
        );
        expect(() => schema.parse({ field: "anything" })).not.toThrow();
      });
    });

    describe("new string formats (time, ipv4, ipv6)", () => {
      it("validates time format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "time" } })
        );
        expect(() => schema.parse({ field: "14:30:00" })).not.toThrow();
        expect(() => schema.parse({ field: "not-a-time" })).toThrow();
      });

      it("validates ipv4 format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "ipv4" } })
        );
        expect(() => schema.parse({ field: "192.168.1.1" })).not.toThrow();
        expect(() => schema.parse({ field: "not-an-ip" })).toThrow();
      });

      it("validates ipv6 format", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", format: "ipv6" } })
        );
        expect(() => schema.parse({ field: "::1" })).not.toThrow();
        expect(() => schema.parse({ field: "not-an-ipv6" })).toThrow();
      });
    });

    describe("uniqueItems", () => {
      it("rejects duplicate primitives", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: { type: "array", uniqueItems: true, items: { type: "number" } },
          })
        );
        expect(() => schema.parse({ field: [1, 2, 3] })).not.toThrow();
        expect(() => schema.parse({ field: [1, 2, 1] })).toThrow();
      });

      it("rejects duplicate objects regardless of key order", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "array",
              uniqueItems: true,
              items: {
                type: "object",
                properties: {
                  a: { type: "number" },
                  b: { type: "number" },
                },
                required: ["a", "b"],
              },
            },
          })
        );
        // Same keys, different insertion order -> should be detected as duplicate
        expect(() =>
          schema.parse({ field: [{ a: 1, b: 2 }, { b: 2, a: 1 }] })
        ).toThrow();
      });

      it("accepts distinct objects", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: {
              type: "array",
              uniqueItems: true,
              items: {
                type: "object",
                properties: {
                  a: { type: "number" },
                  b: { type: "number" },
                },
                required: ["a", "b"],
              },
            },
          })
        );
        expect(() =>
          schema.parse({ field: [{ a: 1, b: 2 }, { a: 1, b: 3 }] })
        ).not.toThrow();
      });

      it("handles nested objects", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: { type: "array", uniqueItems: true },
          })
        );
        expect(() =>
          schema.parse({ field: [{ x: { b: 2, a: 1 } }, { x: { a: 1, b: 2 } }] })
        ).toThrow();
      });

      it("allows duplicates when uniqueItems is not set", () => {
        const schema = buildInputSchema(
          makeSchema({
            field: { type: "array", items: { type: "number" } },
          })
        );
        expect(() => schema.parse({ field: [1, 1, 1] })).not.toThrow();
      });
    });

    describe("description", () => {
      it("applies description to the schema field", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", description: "Search query" } })
        );
        // Schema is created successfully; description is metadata
        expect(() => schema.parse({ field: "test" })).not.toThrow();
      });

      it("handles empty description without error", () => {
        const schema = buildInputSchema(
          makeSchema({ field: { type: "string", description: "" } })
        );
        expect(() => schema.parse({ field: "test" })).not.toThrow();
      });
    });

    describe("additionalProperties", () => {
      it("strips unknown fields by default", () => {
        const schema = buildInputSchema(
          makeSchema({ name: { type: "string" } }, ["name"])
        );
        const result = schema.parse({ name: "test", extra: 42 });
        expect(result).toEqual({ name: "test" });
        expect(result).not.toHaveProperty("extra");
      });

      it("preserves unknown fields when additionalProperties is true", () => {
        const schema = buildInputSchema({
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
          additionalProperties: true,
        });
        const result = schema.parse({ name: "test", extra: 42, nested: { a: 1 } });
        expect(result).toEqual({ name: "test", extra: 42, nested: { a: 1 } });
      });

      it("still validates defined fields when additionalProperties is true", () => {
        const schema = buildInputSchema({
          type: "object",
          properties: { count: { type: "number" } },
          required: ["count"],
          additionalProperties: true,
        });
        expect(() => schema.parse({ count: "not-a-number", extra: true })).toThrow();
      });

      it("works with nested object that has additionalProperties on inner object", () => {
        const schema = buildInputSchema({
          type: "object",
          properties: {
            config: {
              type: "object",
              properties: { name: { type: "string" } },
              required: ["name"],
              additionalProperties: true,
            },
          },
          required: ["config"],
        });
        const result = schema.parse({ config: { name: "test", extra: "val" } });
        expect(result.config).toEqual({ name: "test", extra: "val" });
      });

      it("top-level passthrough does not affect inner objects without the flag", () => {
        const schema = buildInputSchema({
          type: "object",
          properties: {
            inner: {
              type: "object",
              properties: { a: { type: "number" } },
              required: ["a"],
            },
          },
          required: ["inner"],
          additionalProperties: true,
        });
        const result = schema.parse({ inner: { a: 1, b: 2 }, topExtra: "yes" });
        expect(result.topExtra).toBe("yes");
        // inner object should still strip (no additionalProperties flag)
        expect(result.inner).toEqual({ a: 1 });
      });
    });
  });
});
