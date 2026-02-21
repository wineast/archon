import { describe, it, expect } from "vitest";
import { isObjectSchema, validateObjectSchema } from "../json-schema-utils";

describe("isObjectSchema", () => {
  it('returns true for { type: "object" }', () => {
    expect(isObjectSchema({ type: "object", properties: {} })).toBe(true);
  });

  it("returns true for implicit object (has properties)", () => {
    expect(isObjectSchema({ properties: { a: { type: "string" } } })).toBe(true);
  });

  it("returns true for allOf", () => {
    expect(isObjectSchema({ allOf: [{ type: "object" }] })).toBe(true);
  });

  it("returns true for anyOf", () => {
    expect(isObjectSchema({ anyOf: [{ type: "object" }] })).toBe(true);
  });

  it("returns true for oneOf", () => {
    expect(isObjectSchema({ oneOf: [{ type: "object" }] })).toBe(true);
  });

  it("returns true for $ref", () => {
    expect(isObjectSchema({ $ref: "#/$defs/foo" })).toBe(true);
  });

  it('returns false for { type: "string" }', () => {
    expect(isObjectSchema({ type: "string" })).toBe(false);
  });

  it('returns false for { type: "array" }', () => {
    expect(isObjectSchema({ type: "array", items: {} })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isObjectSchema(null)).toBe(false);
  });

  it("returns false for non-object primitives", () => {
    expect(isObjectSchema("string")).toBe(false);
    expect(isObjectSchema(42)).toBe(false);
    expect(isObjectSchema(undefined)).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isObjectSchema([{ type: "object" }])).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isObjectSchema({})).toBe(false);
  });
});

describe("validateObjectSchema", () => {
  it("returns null for null value (skip)", () => {
    expect(validateObjectSchema(null, "test")).toBeNull();
  });

  it("returns null for undefined value (skip)", () => {
    expect(validateObjectSchema(undefined, "test")).toBeNull();
  });

  it("returns null for valid object schema", () => {
    expect(validateObjectSchema({ type: "object", properties: {} }, "test")).toBeNull();
  });

  it("returns error for non-object schema", () => {
    const err = validateObjectSchema({ type: "string" }, "parametersSchema");
    expect(err).toBe("parametersSchema must be an object-type schema");
  });

  it("returns error for non-object value", () => {
    const err = validateObjectSchema("not a schema", "field");
    expect(err).toBe("field must be an object-type schema");
  });
});
