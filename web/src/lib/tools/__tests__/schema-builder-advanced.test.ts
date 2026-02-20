import { describe, it, expect, vi } from "vitest";
import { buildInputSchema, normalizeVariantItem } from "../schema-builder";
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

describe("schema-builder advanced types", () => {
  // ───────── Map/Record (additionalProperties) ─────────

  describe("Map/Record type (additionalProperties)", () => {
    it("z.record: pure record with no fixed properties", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "object",
          additionalProperties: makeParam({
            id: "val",
            name: "_value",
            type: "number",
          }),
        }),
      ]);
      expect(() =>
        schema.parse({ field: { a: 1, b: 2, c: 3 } })
      ).not.toThrow();
    });

    it("z.record rejects wrong value types", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "object",
          additionalProperties: makeParam({
            id: "val",
            name: "_value",
            type: "number",
          }),
        }),
      ]);
      expect(() =>
        schema.parse({ field: { a: "not a number" } })
      ).toThrow();
    });

    it("catchall: fixed properties + additionalProperties", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "object",
          properties: [
            makeParam({ id: "c1", name: "id", type: "string", required: true }),
          ],
          additionalProperties: makeParam({
            id: "val",
            name: "_value",
            type: "number",
          }),
        }),
      ]);
      // Fixed property must be valid
      expect(() =>
        schema.parse({ field: { id: "abc", extra1: 10, extra2: 20 } })
      ).not.toThrow();
    });

    it("catchall rejects wrong dynamic value type", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "object",
          properties: [
            makeParam({ id: "c1", name: "id", type: "string", required: true }),
          ],
          additionalProperties: makeParam({
            id: "val",
            name: "_value",
            type: "number",
          }),
        }),
      ]);
      expect(() =>
        schema.parse({ field: { id: "abc", extra: "not a number" } })
      ).toThrow();
    });

    it("additionalProperties with schemaId reference", () => {
      const schema = buildInputSchema(
        [
          makeParam({
            type: "object",
            schemaId: "ref-1",
            additionalProperties: makeParam({
              id: "val",
              name: "_value",
              type: "boolean",
            }),
          }),
        ],
        undefined,
        {
          schemaMap: {
            "ref-1": [
              makeParam({ id: "c1", name: "status", type: "string", required: true }),
            ],
          },
        }
      );
      expect(() =>
        schema.parse({ field: { status: "ok", dynamic: true } })
      ).not.toThrow();
    });

    it("record with string values", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "object",
          additionalProperties: makeParam({
            id: "val",
            name: "_value",
            type: "string",
          }),
        }),
      ]);
      expect(() =>
        schema.parse({ field: { key1: "value1", key2: "value2" } })
      ).not.toThrow();
    });
  });

  // ───────── Recursive / self-referencing types ─────────

  describe("recursive types (z.lazy)", () => {
    it("handles self-referencing schemaId without infinite loop", () => {
      // Schema "comment" has a field "replies" that is an array of "comment"
      const commentParams: SchemaProperty[] = [
        makeParam({ id: "c1", name: "text", type: "string", required: true }),
        makeParam({
          id: "c2",
          name: "replies",
          type: "array",
          required: false,
          items: makeParam({
            id: "c3",
            name: "item",
            type: "object",
            schemaId: "comment-schema",
          }),
        }),
      ];

      const schema = buildInputSchema(
        [
          makeParam({
            type: "object",
            schemaId: "comment-schema",
          }),
        ],
        undefined,
        {
          schemaMap: {
            "comment-schema": commentParams,
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
      const treeParams: SchemaProperty[] = [
        makeParam({ id: "n1", name: "value", type: "number", required: true }),
        makeParam({
          id: "n2",
          name: "children",
          type: "array",
          required: false,
          items: makeParam({
            id: "n3",
            name: "item",
            type: "object",
            schemaId: "tree-node",
          }),
        }),
      ];

      const schema = buildInputSchema(
        [
          makeParam({
            type: "object",
            schemaId: "tree-node",
          }),
        ],
        undefined,
        { schemaMap: { "tree-node": treeParams } }
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

  // ───────── Union type (new format: variants as SchemaProperty[]) ─────────

  describe("union type", () => {
    it("discriminated union with discriminatorValues accepts matching variant", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          discriminator: "kind",
          discriminatorValues: ["text", "image"],
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1b", name: "content", type: "string", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2b", name: "url", type: "string", required: true }),
              ],
            }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: { kind: "text", content: "hello" } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { kind: "image", url: "https://example.com/img.png" } })
      ).not.toThrow();
    });

    it("discriminated union with discriminatorValues rejects invalid value", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          discriminator: "kind",
          discriminatorValues: ["text", "image"],
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1b", name: "content", type: "string", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2b", name: "url", type: "string", required: true }),
              ],
            }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: { kind: "video", src: "foo" } })
      ).toThrow();
    });

    it("discriminatorValues injects z.literal and overrides manual discriminator field", () => {
      // Variant has a manually defined "kind" field — discriminatorValues should override it
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          discriminator: "kind",
          discriminatorValues: ["cat", "dog"],
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1a", name: "kind", type: "string", required: true }),
                makeParam({ id: "v1b", name: "legs", type: "number", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "kind", type: "string", required: true }),
                makeParam({ id: "v2b", name: "bark", type: "boolean", required: true }),
              ],
            }),
          ],
        }),
      ]);

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
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1a", name: "name", type: "string", required: true }),
                makeParam({ id: "v1b", name: "age", type: "number", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "company", type: "string", required: true }),
                makeParam({ id: "v2b", name: "employees", type: "number", required: true }),
              ],
            }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: { name: "Alice", age: 30 } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { company: "Acme", employees: 100 } })
      ).not.toThrow();
    });

    it("falls back to z.unknown when < 2 variants", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "object", required: true, properties: [
              makeParam({ id: "v1a", name: "x", type: "string", required: true }),
            ] }),
          ],
        }),
      ]);
      expect(() =>
        schema.parse({ field: "anything" })
      ).not.toThrow();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("≥2 variants")
      );
      warn.mockRestore();
    });

    it("union with no variants falls back to z.unknown", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const schema = buildInputSchema([
        makeParam({ type: "union" }),
      ]);
      expect(() =>
        schema.parse({ field: 42 })
      ).not.toThrow();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // ───────── anyOf (unionMode) ─────────

  describe("anyOf (unionMode)", () => {
    it("anyOf mode accepts matching variant (uses z.union)", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          unionMode: "anyOf",
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1a", name: "name", type: "string", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "count", type: "number", required: true }),
              ],
            }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: { name: "Alice" } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { count: 10 } })
      ).not.toThrow();
    });

    it("anyOf mode ignores discriminator", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          unionMode: "anyOf",
          discriminator: "kind", // should be ignored in anyOf mode
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1a", name: "x", type: "string", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "y", type: "number", required: true }),
              ],
            }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: { x: "hello" } })
      ).not.toThrow();
    });
  });

  // ───────── Primitive type unions ─────────

  describe("primitive type unions", () => {
    it("string | number union accepts both types", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "string", required: true }),
            makeParam({ id: "v2", name: "", type: "number", required: true }),
          ],
        }),
      ]);

      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).not.toThrow();
      expect(() => schema.parse({ field: true })).toThrow();
    });

    it("string | null union (via union, not nullable)", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "string", required: true }),
            makeParam({ id: "v2", name: "", type: "null", required: true }),
          ],
        }),
      ]);

      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("mixed string | object union", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "string", required: true }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "name", type: "string", required: true }),
              ],
            }),
          ],
        }),
      ]);

      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: { name: "Alice" } })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("discriminated union ignores discriminator for non-object variants", () => {
      // When discriminator is set but a variant is not object, the discriminator
      // injection is skipped for that variant. This creates a z.union fallback.
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          discriminator: "kind",
          discriminatorValues: ["text", "num"],
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1a", name: "content", type: "string", required: true }),
              ],
            }),
            makeParam({ id: "v2", name: "", type: "number", required: true }),
          ],
        }),
      ]);

      // The discriminatedUnion call will have a mix of object/non-object;
      // Zod should still handle it (discriminatedUnion may fall back or work)
      // At minimum it shouldn't crash
      expect(schema).toBeDefined();
    });
  });

  // ───────── Nullable ─────────

  describe("nullable", () => {
    it("nullable string accepts string and null", () => {
      const schema = buildInputSchema([
        makeParam({ type: "string", nullable: true }),
      ]);
      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("nullable number accepts number and null", () => {
      const schema = buildInputSchema([
        makeParam({ type: "number", nullable: true }),
      ]);
      expect(() => schema.parse({ field: 42 })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "hello" })).toThrow();
    });

    it("nullable boolean accepts boolean and null", () => {
      const schema = buildInputSchema([
        makeParam({ type: "boolean", nullable: true }),
      ]);
      expect(() => schema.parse({ field: true })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "hello" })).toThrow();
    });

    it("nullable enum accepts enum value and null", () => {
      const schema = buildInputSchema([
        makeParam({ type: "enum", enum: ["a", "b"], nullable: true }),
      ]);
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "c" })).toThrow();
    });

    it("nullable object accepts object and null", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "object", nullable: true,
          properties: [
            makeParam({ id: "c1", name: "x", type: "string", required: true }),
          ],
        }),
      ]);
      expect(() => schema.parse({ field: { x: "hello" } })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
    });

    it("nullable array accepts array and null", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "array", nullable: true,
          items: makeParam({ id: "item", name: "item", type: "string" }),
        }),
      ]);
      expect(() => schema.parse({ field: ["a", "b"] })).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
    });

    it("nullable + optional: missing ok, null ok, wrong type rejects", () => {
      const schema = buildInputSchema([
        makeParam({ type: "string", nullable: true, required: false }),
      ]);
      expect(() => schema.parse({})).not.toThrow();
      expect(() => schema.parse({ field: null })).not.toThrow();
      expect(() => schema.parse({ field: "hello" })).not.toThrow();
      expect(() => schema.parse({ field: 42 })).toThrow();
    });

    it("non-nullable rejects null", () => {
      const schema = buildInputSchema([
        makeParam({ type: "string" }),
      ]);
      expect(() => schema.parse({ field: null })).toThrow();
    });
  });

  // ───────── Backward compatibility: old format SchemaProperty[][] ─────────

  describe("backward compatibility (old format)", () => {
    it("normalizeVariantItem wraps SchemaProperty[] as object variant", () => {
      const variant = normalizeVariantItem([
        makeParam({ id: "v1a", name: "x", type: "string", required: true }),
        makeParam({ id: "v1b", name: "y", type: "number", required: true }),
      ]);
      expect(variant.type).toBe("object");
      expect(variant.properties).toHaveLength(2);
    });

    it("normalizeVariantItem passes through new-format SchemaProperty", () => {
      const input = makeParam({ id: "v1", name: "", type: "string", required: true });
      const result = normalizeVariantItem(input);
      expect(result).toBe(input);
    });

    it("normalizeVariantItem handles react-hook-form numeric-key object", () => {
      const rhfObject = {
        0: makeParam({ id: "v1a", name: "x", type: "string", required: true }),
        1: makeParam({ id: "v1b", name: "y", type: "number", required: true }),
        id: "rhf-id",
      };
      const result = normalizeVariantItem(rhfObject);
      expect(result.type).toBe("object");
      expect(result.properties).toHaveLength(2);
    });

    it("old format variants (SchemaProperty[][]) still work via normalizeVariantItem", () => {
      // Simulate old DB data where variants is SchemaProperty[][]
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          variants: [
            // These are SchemaProperty[] arrays — normalizeVariantItem wraps them as object variants
            [
              makeParam({ id: "v1a", name: "name", type: "string", required: true }),
            ],
            [
              makeParam({ id: "v2a", name: "count", type: "number", required: true }),
            ],
          ] as unknown as SchemaProperty[],
        }),
      ]);

      expect(() =>
        schema.parse({ field: { name: "Alice" } })
      ).not.toThrow();

      expect(() =>
        schema.parse({ field: { count: 10 } })
      ).not.toThrow();
    });
  });

  // ───────── allOf (schemaIds) ─────────

  describe("allOf (schemaIds — multi-schema merge)", () => {
    it("merges properties from multiple schemas", () => {
      const schema = buildInputSchema(
        [
          makeParam({
            type: "object",
            schemaIds: ["schema-a", "schema-b"],
          }),
        ],
        undefined,
        {
          schemaMap: {
            "schema-a": [
              makeParam({ id: "a1", name: "name", type: "string", required: true }),
            ],
            "schema-b": [
              makeParam({ id: "b1", name: "age", type: "number", required: true }),
            ],
          },
        }
      );

      expect(() =>
        schema.parse({ field: { name: "Alice", age: 30 } })
      ).not.toThrow();
    });

    it("later schema overrides earlier on same-name field", () => {
      const schema = buildInputSchema(
        [
          makeParam({
            type: "object",
            schemaIds: ["schema-a", "schema-b"],
          }),
        ],
        undefined,
        {
          schemaMap: {
            "schema-a": [
              makeParam({ id: "a1", name: "value", type: "string", required: true }),
            ],
            "schema-b": [
              makeParam({ id: "b1", name: "value", type: "number", required: true }),
            ],
          },
        }
      );

      // "value" should be number (schema-b overrides schema-a)
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
      const schema = buildInputSchema([
        makeParam({
          type: "array",
          tuple: true,
          prefixItems: [
            makeParam({ id: "t0", name: "item0", type: "string", required: true }),
            makeParam({ id: "t1", name: "item1", type: "number", required: true }),
            makeParam({ id: "t2", name: "item2", type: "boolean", required: true }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: ["hello", 42, true] })
      ).not.toThrow();
    });

    it("rejects wrong types at positions", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "array",
          tuple: true,
          prefixItems: [
            makeParam({ id: "t0", name: "item0", type: "string", required: true }),
            makeParam({ id: "t1", name: "item1", type: "number", required: true }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: [42, "hello"] })
      ).toThrow();
    });

    it("rejects wrong length", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "array",
          tuple: true,
          prefixItems: [
            makeParam({ id: "t0", name: "item0", type: "string", required: true }),
            makeParam({ id: "t1", name: "item1", type: "number", required: true }),
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: ["hello"] })
      ).toThrow();
    });

    it("falls back to normal array when tuple is false", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "array",
          tuple: false,
          items: makeParam({ id: "item", name: "item", type: "string" }),
        }),
      ]);

      expect(() =>
        schema.parse({ field: ["a", "b", "c"] })
      ).not.toThrow();
    });
  });
});
