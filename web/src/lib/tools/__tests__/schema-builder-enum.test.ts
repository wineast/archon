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

  describe("template string enum: {{var}} → resolved from resolvedVars", () => {
    it("resolves {{var}} from array in resolvedVars", () => {
      const resolvedVars = {
        state_enum: ["CA", "NY", "TX"],
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{state_enum}}"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "CA" })).not.toThrow();
      expect(() => schema.parse({ field: "FL" })).toThrow();
    });

    it("resolves {{var}} from object with string values (takes values)", () => {
      const resolvedVars = {
        income_types: { salary: "Salary", bonus: "Bonus", rental: "Rental Income" },
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{income_types}}"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "Salary" })).not.toThrow();
      expect(() => schema.parse({ field: "Bonus" })).not.toThrow();
      expect(() => schema.parse({ field: "salary" })).toThrow(); // key, not value
    });

    it("resolves {{var}} from object with non-string values (takes keys)", () => {
      const resolvedVars = {
        nums: { a: 1, b: 2, c: 3 },
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{nums}}"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "a" })).not.toThrow();
      expect(() => schema.parse({ field: "1" })).toThrow();
    });

    it("keeps raw template string when var is not found", () => {
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["{{unknown_var}}"] } }),
        {}
      );
      // Falls back to the literal "{{unknown_var}}"
      expect(() => schema.parse({ field: "{{unknown_var}}" })).not.toThrow();
      expect(() => schema.parse({ field: "anything_else" })).toThrow();
    });

    it("mixes template and literal enum values", () => {
      const resolvedVars = {
        dynamic: ["X", "Y"],
      };
      const schema = buildInputSchema(
        makeSchema({ field: { type: "string", enum: ["A", "{{dynamic}}", "Z"] } }),
        resolvedVars
      );
      expect(() => schema.parse({ field: "A" })).not.toThrow();
      expect(() => schema.parse({ field: "X" })).not.toThrow();
      expect(() => schema.parse({ field: "Y" })).not.toThrow();
      expect(() => schema.parse({ field: "Z" })).not.toThrow();
      expect(() => schema.parse({ field: "B" })).toThrow();
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
