import { describe, it, expect, vi } from "vitest";
import { parseTemplateVarValue } from "../parse";

describe("parseTemplateVarValue", () => {
  // --- text ---
  it("returns text value as-is", () => {
    expect(parseTemplateVarValue("hello", "text")).toBe("hello");
  });

  it("returns empty string for text type", () => {
    expect(parseTemplateVarValue("", "text")).toBe("");
  });

  it("treats unknown type as text", () => {
    expect(parseTemplateVarValue("abc", "unknown")).toBe("abc");
  });

  // --- number ---
  it("parses number value", () => {
    expect(parseTemplateVarValue("0.75", "number")).toBe(0.75);
  });

  it("parses integer number value", () => {
    expect(parseTemplateVarValue("42", "number")).toBe(42);
  });

  it("parses negative number", () => {
    expect(parseTemplateVarValue("-3.14", "number")).toBe(-3.14);
  });

  it("falls back to string for invalid number", () => {
    expect(parseTemplateVarValue("not-a-number", "number")).toBe(
      "not-a-number"
    );
  });

  it("falls back to string for empty number", () => {
    expect(parseTemplateVarValue("", "number")).toBe("");
  });

  // --- boolean ---
  it('parses "true" as boolean true', () => {
    expect(parseTemplateVarValue("true", "boolean")).toBe(true);
  });

  it('parses "false" as boolean false', () => {
    expect(parseTemplateVarValue("false", "boolean")).toBe(false);
  });

  it("parses any non-true string as false", () => {
    expect(parseTemplateVarValue("yes", "boolean")).toBe(false);
    expect(parseTemplateVarValue("1", "boolean")).toBe(false);
    expect(parseTemplateVarValue("", "boolean")).toBe(false);
  });

  // --- legacy list ---
  it("parses valid JSON array for list type (legacy)", () => {
    expect(parseTemplateVarValue('["en","zh","es"]', "list")).toEqual([
      "en",
      "zh",
      "es",
    ]);
  });

  it("parses empty JSON array for list type (legacy)", () => {
    expect(parseTemplateVarValue("[]", "list")).toEqual([]);
  });

  it("falls back to raw string for invalid list JSON (legacy)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseTemplateVarValue("not-json", "list")).toBe("not-json");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("falls back to raw string when list JSON is not an array (legacy)", () => {
    expect(parseTemplateVarValue('{"a":1}', "list")).toBe('{"a":1}');
  });

  // --- json ---
  it("parses valid JSON object", () => {
    expect(
      parseTemplateVarValue('{"city":"LA","state":"CA"}', "json")
    ).toEqual({ city: "LA", state: "CA" });
  });

  it("parses JSON array (valid JSON, not just objects)", () => {
    expect(parseTemplateVarValue("[1,2,3]", "json")).toEqual([1, 2, 3]);
  });

  it("falls back to raw string for invalid JSON", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseTemplateVarValue("{bad json", "json")).toBe("{bad json");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  // --- isArray: text[] ---
  it("parses text array with isArray=true", () => {
    expect(
      parseTemplateVarValue('["en","zh","es"]', "text", true)
    ).toEqual(["en", "zh", "es"]);
  });

  it("parses empty array with isArray=true", () => {
    expect(parseTemplateVarValue("[]", "text", true)).toEqual([]);
  });

  // --- isArray: number[] ---
  it("parses number array with isArray=true", () => {
    expect(
      parseTemplateVarValue("[1,2.5,3]", "number", true)
    ).toEqual([1, 2.5, 3]);
  });

  it("falls back for invalid number in array", () => {
    expect(
      parseTemplateVarValue('["abc","2"]', "number", true)
    ).toEqual(["abc", 2]);
  });

  // --- isArray: boolean[] ---
  it("parses boolean array with isArray=true", () => {
    expect(
      parseTemplateVarValue('["true","false","true"]', "boolean", true)
    ).toEqual([true, false, true]);
  });

  // --- isArray: json[] ---
  it("parses json array with isArray=true", () => {
    expect(
      parseTemplateVarValue('[{"a":1},{"b":2}]', "json", true)
    ).toEqual([{ a: 1 }, { b: 2 }]);
  });

  // --- isArray fallback cases ---
  it("falls back to raw string when isArray value is invalid JSON", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseTemplateVarValue("not-json", "text", true)).toBe("not-json");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("falls back to raw string when isArray value is not an array", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseTemplateVarValue('{"a":1}', "text", true)).toBe('{"a":1}');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  // --- isArray=false behaves like scalar ---
  it("isArray=false behaves like scalar", () => {
    expect(parseTemplateVarValue("hello", "text", false)).toBe("hello");
    expect(parseTemplateVarValue("42", "number", false)).toBe(42);
  });
});
