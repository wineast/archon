import { describe, it, expect } from "vitest";
import { remapParameterRefs } from "../snapshot";
import type { JsonSchema7 } from "@/lib/schemas/types";

describe("remapParameterRefs", () => {
  it("returns schema unchanged (no-op after x-enumDatasetId removal)", () => {
    const schema: JsonSchema7 = {
      type: "object",
      properties: {
        query: { type: "string", description: "search" },
        count: { type: "number" },
      },
      required: ["query"],
    };
    const result = remapParameterRefs(schema);
    expect(result).toBe(schema);
  });

  it("passes through empty schema", () => {
    const schema: JsonSchema7 = { type: "object", properties: {}, required: [] };
    const result = remapParameterRefs(schema);
    expect(result).toBe(schema);
  });

  it("leaves $ref values untouched", () => {
    const schema: JsonSchema7 = {
      type: "object",
      properties: {
        address: { $ref: "#/$defs/address_fields" },
      },
    };
    const result = remapParameterRefs(schema);
    expect(result.properties!.address.$ref).toBe("#/$defs/address_fields");
  });

  it("preserves template enum strings", () => {
    const schema: JsonSchema7 = {
      type: "object",
      properties: {
        state: { type: "string", enum: ["{{state_enum}}"] },
      },
    };
    const result = remapParameterRefs(schema);
    expect(result.properties!.state.enum).toEqual(["{{state_enum}}"]);
  });
});
