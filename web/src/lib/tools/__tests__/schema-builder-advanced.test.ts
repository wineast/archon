import { describe, it, expect, vi } from "vitest";
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

  // ───────── Union type ─────────

  describe("union type", () => {
    it("discriminated union accepts matching variant", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          discriminator: "kind",
          variants: [
            [
              makeParam({ id: "v1a", name: "kind", type: "enum", enum: ["text"], required: true }),
              makeParam({ id: "v1b", name: "content", type: "string", required: true }),
            ],
            [
              makeParam({ id: "v2a", name: "kind", type: "enum", enum: ["image"], required: true }),
              makeParam({ id: "v2b", name: "url", type: "string", required: true }),
            ],
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

    it("discriminated union rejects invalid discriminator value", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          discriminator: "kind",
          variants: [
            [
              makeParam({ id: "v1a", name: "kind", type: "enum", enum: ["text"], required: true }),
              makeParam({ id: "v1b", name: "content", type: "string", required: true }),
            ],
            [
              makeParam({ id: "v2a", name: "kind", type: "enum", enum: ["image"], required: true }),
              makeParam({ id: "v2b", name: "url", type: "string", required: true }),
            ],
          ],
        }),
      ]);

      expect(() =>
        schema.parse({ field: { kind: "video", src: "foo" } })
      ).toThrow();
    });

    it("plain union (no discriminator) accepts any matching variant", () => {
      const schema = buildInputSchema([
        makeParam({
          type: "union",
          variants: [
            [
              makeParam({ id: "v1a", name: "name", type: "string", required: true }),
              makeParam({ id: "v1b", name: "age", type: "number", required: true }),
            ],
            [
              makeParam({ id: "v2a", name: "company", type: "string", required: true }),
              makeParam({ id: "v2b", name: "employees", type: "number", required: true }),
            ],
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
            [makeParam({ id: "v1a", name: "x", type: "string", required: true })],
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
});
