import { describe, it, expect } from "vitest";
import {
  extractRefKey,
  resolveInlineSchema,
  expandSchemaRefs,
} from "../resolve-inline";
import type { JsonSchema7 } from "@/lib/schemas/types";

describe("extractRefKey", () => {
  it("extracts key from valid $ref", () => {
    expect(extractRefKey({ $ref: "#/$defs/my_schema" })).toBe("my_schema");
  });

  it("returns null for non-$ref schema", () => {
    expect(extractRefKey({ type: "object", properties: {} })).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractRefKey(null)).toBeNull();
  });

  it("returns null for invalid $ref format", () => {
    expect(extractRefKey({ $ref: "other/path" })).toBeNull();
  });
});

describe("resolveInlineSchema", () => {
  const defsMap: Record<string, JsonSchema7> = {
    address: {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
      },
      required: ["street", "city"],
    },
  };

  it("resolves a $ref to the corresponding schema in defsMap", () => {
    const result = resolveInlineSchema({ $ref: "#/$defs/address" }, defsMap);
    expect(result).toEqual(defsMap.address);
  });

  it("returns schema as-is when it is not a $ref", () => {
    const schema: JsonSchema7 = { type: "string" };
    const result = resolveInlineSchema(schema, defsMap);
    expect(result).toBe(schema);
  });

  it("returns null when input is null", () => {
    expect(resolveInlineSchema(null, defsMap)).toBeNull();
  });

  it("returns null when $ref key is not found in defsMap", () => {
    expect(resolveInlineSchema({ $ref: "#/$defs/unknown" }, defsMap)).toBeNull();
  });
});

describe("expandSchemaRefs", () => {
  const defsMap: Record<string, JsonSchema7> = {
    name_field: { type: "string", description: "A name" },
    address: {
      type: "object",
      properties: {
        street: { type: "string" },
        zip: { $ref: "#/$defs/name_field" },
      },
    },
  };

  it("expands a top-level $ref", () => {
    const result = expandSchemaRefs({ $ref: "#/$defs/name_field" }, defsMap);
    expect(result).toEqual({ type: "string", description: "A name" });
  });

  it("expands nested $ref in properties", () => {
    const result = expandSchemaRefs({ $ref: "#/$defs/address" }, defsMap);
    expect(result.properties?.zip).toEqual({ type: "string", description: "A name" });
  });

  it("handles circular references without infinite loop", () => {
    const circularDefs: Record<string, JsonSchema7> = {
      node: {
        type: "object",
        properties: {
          child: { $ref: "#/$defs/node" },
        },
      },
    };
    const result = expandSchemaRefs({ $ref: "#/$defs/node" }, circularDefs);
    // The top level should be expanded, but the nested circular ref should be kept
    expect(result.type).toBe("object");
    expect(result.properties?.child).toEqual({ $ref: "#/$defs/node" });
  });

  it("keeps unknown $ref as-is", () => {
    const result = expandSchemaRefs({ $ref: "#/$defs/missing" }, defsMap);
    expect(result).toEqual({ $ref: "#/$defs/missing" });
  });

  it("expands $ref inside items", () => {
    const schema: JsonSchema7 = {
      type: "array",
      items: { $ref: "#/$defs/name_field" },
    };
    const result = expandSchemaRefs(schema, defsMap);
    expect(result.items).toEqual({ type: "string", description: "A name" });
  });

  it("expands $ref inside allOf", () => {
    const schema: JsonSchema7 = {
      allOf: [
        { $ref: "#/$defs/name_field" },
      ],
    };
    const result = expandSchemaRefs(schema, defsMap);
    expect(result.allOf?.[0]).toEqual({ type: "string", description: "A name" });
  });
});
