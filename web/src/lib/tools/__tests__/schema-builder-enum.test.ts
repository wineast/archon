import { describe, it, expect } from "vitest";
import { buildInputSchema } from "../schema-builder";
import type { JsonSchema7 } from "@/lib/schemas/types";

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

describe("schema-builder — enum type", () => {
  describe("type: string with enum (manual values)", () => {
    it("accepts values in enum list", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["CA", "NY", "TX"] } })
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "NY" })).not.toThrow();
    });

    it("rejects values not in enum list", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["CA", "NY", "TX"] } })
      );
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });

    it("falls back to z.string() when enum is empty", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: [] } })
      );
      expect(() => schema.parse({ field: "anything" })).not.toThrow();
    });

    it("falls back to z.string() when enum is undefined", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string" } })
      );
      expect(() => schema.parse({ field: "anything" })).not.toThrow();
    });

    it("works with optional enum param", () => {
      const schema = buildInputSchema(
        makeSchema(
          { field: { type: "string", enum: ["a", "b"] } },
          [] // not required
        )
      );
      expect(() => schema.parse({})).not.toThrow();
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "c" })).toThrow();
    });
  });

  describe("LiquidJS filter enum: {{ var | json }}", () => {
    it("resolves array with json filter", () => {
      const resolvedVars = {
        state_enum: ["CA", "NY", "TX"],
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{ state_enum | json }}"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });

    it("resolves object keys with keys + json filters", () => {
      const resolvedVars = {
        product_map: { universe: "Universe Product", standard: "Standard Product" },
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{ product_map | keys | json }}"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "universe" })).not.toThrow();
      expect(() => schema.parse({ field: "standard" })).not.toThrow();
      expect(() => schema.parse({ field: "Universe Product" })).toThrow();
    });

    it("resolves object values with values + json filters", () => {
      const resolvedVars = {
        income_types: { salary: "Salary", bonus: "Bonus", rental: "Rental Income" },
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{ income_types | values | json }}"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "Salary" })).not.toThrow();
      expect(() => schema.parse({ field: "Bonus" })).not.toThrow();
      expect(() => schema.parse({ field: "salary" })).toThrow(); // key, not value
    });

    it("resolves with map + json filters", () => {
      const resolvedVars = {
        products: [
          { name: "Widget", price: 10 },
          { name: "Gadget", price: 20 },
        ],
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ['{{ products | map: "name" | json }}'] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "Widget" })).not.toThrow();
      expect(() => schema.parse({ field: "Gadget" })).not.toThrow();
      expect(() => schema.parse({ field: "Unknown" })).toThrow();
    });

    it("renders empty string when var is not found", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{ unknown_var | json }}"] } }),
        {}
      );
      // unknown_var resolves to empty string, json of "" is `""`, renderField returns ""
      // LiquidJS renders {{ unknown_var | json }} → "" (empty string goes through json → `""` without quotes in output)
      // Actually: unknown_var is undefined → LiquidJS outputs "" (empty), json filter gets "" → outputs `""`
      // renderField returns the rendered string `""`, doesn't start with [ so used as literal
      expect(() => schema.parse({ field: "" })).not.toThrow();
    });

    it("mixes template and literal enum values", () => {
      const resolvedVars = {
        dynamic: ["X", "Y"],
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["A", "{{ dynamic | json }}", "Z"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "A" })).not.toThrow();
      expect(() => schema.parse({ field: "X" })).not.toThrow();
      expect(() => schema.parse({ field: "Y" })).not.toThrow();
      expect(() => schema.parse({ field: "Z" })).not.toThrow();
      expect(() => schema.parse({ field: "B" })).toThrow();
    });

    it("keeps literal string when no resolvedVars provided", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{ x | json }}"] } })
      );
      // No resolvedVars → s.includes("{{") but no resolvedVars, kept as literal
      expect(() => schema.parse({ field: "{{ x | json }}" })).not.toThrow();
    });

    it("handles non-array json output as literal", () => {
      const resolvedVars = {
        single: "hello",
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{ single | json }}"] } }),
        resolvedVars
      );
      // json filter outputs "hello" (JSON string), starts with " not [
      expect(() => schema.parse({ field: '"hello"' })).not.toThrow();
    });
  });

  describe("string with enum enforces enum values (JSON Schema 7 behavior)", () => {
    it("string type with enum values enforces them (z.enum, not z.string)", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["a", "b"] } })
      );
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "b" })).not.toThrow();
      // "c" is rejected because enum takes effect in JSON Schema 7
      expect(() => schema.parse({ field: "c" })).toThrow();
    });
  });
});
