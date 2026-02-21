import { describe, it, expect } from "vitest";
import { buildInputSchema } from "../schema-builder";
import type { JsonSchema7 } from "@/lib/schemas/types";

/** Helper: wrap properties into a root object schema. */
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

describe("schema-builder advanced types", () => {
  // ───────── Map/Record (additionalProperties) ─────────

  describe("Map/Record type (additionalProperties)", () => {
    it("z.record: pure record with no fixed properties", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        })
      );
      expect(() =>
        schema.parse({ field: { a: 1, b: 2, c: 3 } })
      ).not.toThrow();
    });

    it("z.record rejects wrong value types", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        })
      );
      expect(() =>
        schema.parse({ field: { a: "not a number" } })
      ).toThrow();
    });

    it("catchall: fixed properties + additionalProperties", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
            required: ["id"],
            additionalProperties: { type: "number" },
          },
        })
      );
      // Fixed property must be valid
      expect(() =>
        schema.parse({ field: { id: "abc", extra1: 10, extra2: 20 } })
      ).not.toThrow();
    });

    it("catchall rejects wrong dynamic value type", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
            required: ["id"],
            additionalProperties: { type: "number" },
          },
        })
      );
      expect(() =>
        schema.parse({ field: { id: "abc", extra: "not a number" } })
      ).toThrow();
    });

    it("additionalProperties with $ref reference", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            $ref: "#/$defs/ref_schema",
          },
        }),
        undefined,
        {
          defsMap: {
            ref_schema: {
              type: "object",
              properties: {
                status: { type: "string" },
              },
              required: ["status"],
              additionalProperties: { type: "boolean" },
            },
          },
        }
      );
      expect(() =>
        schema.parse({ field: { status: "ok", dynamic: true } })
      ).not.toThrow();
    });

    it("record with string values", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        })
      );
      expect(() =>
        schema.parse({ field: { key1: "value1", key2: "value2" } })
      ).not.toThrow();
    });
  });

  // ───────── Recursive / self-referencing types ─────────

  describe("recursive types (z.lazy)", () => {
    it("handles self-referencing $ref without infinite loop", () => {
      // Schema "comment" has a field "replies" that is an array of "comment"
      const commentSchema: JsonSchema7 = {
        type: "object",
        properties: {
          text: { type: "string" },
          replies: {
            type: "array",
            items: {
              $ref: "#/$defs/comment",
            },
          },
        },
        required: ["text"],
      };

      const schema = buildInputSchema(
        makeSchema({
          field: {
            $ref: "#/$defs/comment",
          },
        }),
        undefined,
        {
          defsMap: {
            comment: commentSchema,
          },
        }
      );

      // Flat comment (no replies)
      expect(() =>
        schema.parse({ field: { text: "Hello" } })
      ).not.toThrow();

      // Nested comment
      expect(() =>
        schema.parse({
          field: {
            text: "Parent",
            replies: [
              {
                text: "Child",
                replies: [{ text: "Grandchild" }],
              },
            ],
          },
        })
      ).not.toThrow();
    });

    it("recursive schema validates nested data types", () => {
      const treeSchema: JsonSchema7 = {
        type: "object",
        properties: {
          value: { type: "number" },
          children: {
            type: "array",
            items: {
              $ref: "#/$defs/tree_node",
            },
          },
        },
        required: ["value"],
      };

      const schema = buildInputSchema(
        makeSchema({
          field: {
            $ref: "#/$defs/tree_node",
          },
        }),
        undefined,
        { defsMap: { tree_node: treeSchema } }
      );

      expect(() =>
        schema.parse({ field: { value: "not a number" } })
      ).toThrow();

      expect(() =>
        schema.parse({
          field: {
            value: 1,
            children: [{ value: 2, children: [{ value: 3 }] }],
          },
        })
      ).not.toThrow();
    });
  });

  // ───────── Union type (oneOf) ─────────

  describe("union type", () => {
    it("discriminated union with discriminatorValues accepts matching variant", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              {
                type: "object",
                properties: {
                  content: { type: "string" },
                },
                required: ["content"],
              },
              {
                type: "object",
                properties: {
                  url: { type: "string" },
                },
                required: ["url"],
              },
            ],
            "x-discriminator": "kind",
            "x-discriminatorValues": ["text", "image"],
            "x-unionMode": "oneOf",
          },
        })
      );

      expect(() =>
        schema.parse({ field: { kind: "text", content: "hello" } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { kind: "image", url: "https://example.com/img.png" } })
      ).not.toThrow();
    });

    it("discriminated union with discriminatorValues rejects invalid value", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              {
                type: "object",
                properties: {
                  content: { type: "string" },
                },
                required: ["content"],
              },
              {
                type: "object",
                properties: {
                  url: { type: "string" },
                },
                required: ["url"],
              },
            ],
            "x-discriminator": "kind",
            "x-discriminatorValues": ["text", "image"],
            "x-unionMode": "oneOf",
          },
        })
      );

      expect(() =>
        schema.parse({ field: { kind: "video", src: "foo" } })
      ).toThrow();
    });

    it("discriminatorValues injects z.literal and overrides manual discriminator field", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              {
                type: "object",
                properties: {
                  kind: { type: "string" },
                  legs: { type: "number" },
                },
                required: ["kind", "legs"],
              },
              {
                type: "object",
                properties: {
                  kind: { type: "string" },
                  bark: { type: "boolean" },
                },
                required: ["kind", "bark"],
              },
            ],
            "x-discriminator": "kind",
            "x-discriminatorValues": ["cat", "dog"],
            "x-unionMode": "oneOf",
          },
        })
      );

      expect(() =>
        schema.parse({ field: { kind: "cat", legs: 4 } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { kind: "dog", bark: true } })
      ).not.toThrow();

      // "fish" is not a valid discriminator value
      expect(() =>
        schema.parse({ field: { kind: "fish", legs: 0 } })
      ).toThrow();
    });

    it("plain union (no discriminator) accepts any matching variant", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              {
                type: "object",
                properties: {
                  name: { type: "string" },
                  age: { type: "number" },
                },
                required: ["name", "age"],
              },
              {
                type: "object",
                properties: {
                  company: { type: "string" },
                  employees: { type: "number" },
                },
                required: ["company", "employees"],
              },
            ],
            "x-unionMode": "oneOf",
          },
        })
      );

      expect(() =>
        schema.parse({ field: { name: "Alice", age: 30 } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { company: "Acme", employees: 100 } })
      ).not.toThrow();
    });

    it("falls back to z.unknown when < 2 variants", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              {
                type: "object",
                properties: {
                  x: { type: "string" },
                },
                required: ["x"],
              },
            ],
            "x-unionMode": "oneOf",
          },
        })
      );
      expect(() =>
        schema.parse({ field: "anything" })
      ).not.toThrow();
    });

    it("union with no variants falls back to z.unknown", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [],
            "x-unionMode": "oneOf",
          },
        })
      );
      expect(() =>
        schema.parse({ field: 42 })
      ).not.toThrow();
    });
  });

  // ───────── anyOf (unionMode) ─────────

  describe("anyOf (unionMode)", () => {
    it("anyOf mode accepts matching variant (uses z.union)", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [
              {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
                required: ["name"],
              },
              {
                type: "object",
                properties: {
                  count: { type: "number" },
                },
                required: ["count"],
              },
            ],
            "x-unionMode": "anyOf",
          },
        })
      );

      expect(() =>
        schema.parse({ field: { name: "Alice" } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { count: 10 } })
      ).not.toThrow();
    });

    it("anyOf mode ignores discriminator", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [
              {
                type: "object",
                properties: {
                  x: { type: "string" },
                },
                required: ["x"],
              },
              {
                type: "object",
                properties: {
                  y: { type: "number" },
                },
                required: ["y"],
              },
            ],
            "x-discriminator": "kind", // should be ignored in anyOf mode
            "x-unionMode": "anyOf",
          },
        })
      );

      expect(() =>
        schema.parse({ field: { x: "hello" } })
      ).not.toThrow();
    });
  });

  // ───────── Primitive type unions ─────────

  describe("primitive type unions", () => {
    it("string | number union accepts both types", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              { type: "string" },
              { type: "number" },
            ],
            "x-unionMode": "oneOf",
          },
        })
      );

      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).not.toThrow();
      expect(() => schema.parse({ field: true })).toThrow();
    });

    it("string | null union (via oneOf, not nullable)", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              { type: "string" },
              { type: "null" },
            ],
            "x-unionMode": "oneOf",
          },
        })
      );

      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("mixed string | object union", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
                required: ["name"],
              },
            ],
            "x-unionMode": "oneOf",
          },
        })
      );

      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: { name: "Alice" } })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("discriminated union ignores discriminator for non-object variants", () => {
      // When discriminator is set but a variant is not object, the discriminator
      // injection is skipped for that variant. This creates a z.union fallback.
      const schema = buildInputSchema(
        makeSchema({
          field: {
            oneOf: [
              {
                type: "object",
                properties: {
                  content: { type: "string" },
                },
                required: ["content"],
              },
              { type: "number" },
            ],
            "x-discriminator": "kind",
            "x-discriminatorValues": ["text", "num"],
            "x-unionMode": "oneOf",
          },
        })
      );

      // The discriminatedUnion call will have a mix of object/non-object;
      // At minimum it shouldn't crash
      expect(schema).toBeDefined();
    });
  });

  // ───────── Nullable ─────────

  describe("nullable", () => {
    it("nullable string accepts string and null", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
        })
      );
      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("nullable number accepts number and null", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [{ type: "number" }, { type: "null" }],
          },
        })
      );
      expect(() => schema.parse({ field: 42 })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "hello" })).toThrow();
    });

    it("nullable boolean accepts boolean and null", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [{ type: "boolean" }, { type: "null" }],
          },
        })
      );
      expect(() => schema.parse({ field: true })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "hello" })).toThrow();
    });

    it("nullable enum accepts enum value and null", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [
              { type: "string", enum: ["a", "b"] },
              { type: "null" },
            ],
          },
        })
      );
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "c" })).toThrow();
    });

    it("nullable object accepts object and null", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [
              {
                type: "object",
                properties: {
                  x: { type: "string" },
                },
                required: ["x"],
              },
              { type: "null" },
            ],
          },
        })
      );
      expect(() => schema.parse({ field: { x: "hello" } })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
    });

    it("nullable array accepts array and null", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            anyOf: [
              {
                type: "array",
                items: { type: "string" },
              },
              { type: "null" },
            ],
          },
        })
      );
      expect(() => schema.parse({ field: ["a", "b"] })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
    });

    it("nullable + optional: missing ok, null ok, wrong type rejects", () => {
      const schema = buildInputSchema({
        type: "object",
        properties: {
          field: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
        },
        required: [],
      });
      expect(() => schema.parse({})).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("non-nullable rejects null", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: { type: "string" },
        })
      );
      expect(() => schema.parse({ field: null })).toThrow();
    });
  });

  // ───────── allOf ($ref composition) ─────────

  describe("allOf ($ref — multi-schema merge)", () => {
    it("merges properties from multiple $ref schemas", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            allOf: [
              { $ref: "#/$defs/schema_a" },
              { $ref: "#/$defs/schema_b" },
            ],
          },
        }),
        undefined,
        {
          defsMap: {
            schema_a: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
              required: ["name"],
            },
            schema_b: {
              type: "object",
              properties: {
                age: { type: "number" },
              },
              required: ["age"],
            },
          },
        }
      );

      expect(() =>
        schema.parse({ field: { name: "Alice", age: 30 } })
      ).not.toThrow();
    });

    it("later schema overrides earlier on same-name field", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            allOf: [
              { $ref: "#/$defs/schema_a" },
              { $ref: "#/$defs/schema_b" },
            ],
          },
        }),
        undefined,
        {
          defsMap: {
            schema_a: {
              type: "object",
              properties: {
                value: { type: "string" },
              },
              required: ["value"],
            },
            schema_b: {
              type: "object",
              properties: {
                value: { type: "number" },
              },
              required: ["value"],
            },
          },
        }
      );

      // "value" should be number (schema_b overrides schema_a)
      expect(() =>
        schema.parse({ field: { value: 42 } })
      ).not.toThrow();
      expect(() =>
        schema.parse({ field: { value: "hello" } })
      ).toThrow();
    });
  });

  // ───────── Tuple (prefixItems) ─────────

  describe("tuple (prefixItems)", () => {
    it("validates fixed-position types", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "array",
            prefixItems: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
            ],
          },
        })
      );

      expect(() =>
        schema.parse({ field: ["hello", 42, true] })
      ).not.toThrow();
    });

    it("rejects wrong types at positions", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "array",
            prefixItems: [
              { type: "string" },
              { type: "number" },
            ],
          },
        })
      );

      expect(() =>
        schema.parse({ field: [42, "hello"] })
      ).toThrow();
    });

    it("rejects wrong length", () => {
      const schema = buildInputSchema(
        makeSchema({
          field: {
            type: "array",
            prefixItems: [
              { type: "string" },
              { type: "number" },
            ],
          },
        })
      );

      expect(() =>
        schema.parse({ field: ["hello"] })
      ).toThrow();
    });

    it("falls back to normal array when no prefixItems", () => {
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
  });
});
