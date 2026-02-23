import { describe, expect, it } from "vitest";
import { processTemplate } from "../template";
import type { WikiDocument } from "../types";

function makeDoc(overrides: Partial<WikiDocument> = {}): WikiDocument {
  return {
    id: "doc-1",
    parentId: null,
    key: "",
    name: "Test Doc",
    content: "",
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("processTemplate — built-in filters (json, keys, values)", () => {
  it("json filter serializes value", () => {
    const doc = makeDoc();
    const result = processTemplate(
      "{{ data | json }}",
      { documents: [doc], currentDoc: doc, variables: { data: { a: 1, b: "two" } } }
    );
    expect(result).toBe('{"a":1,"b":"two"}');
  });

  it("json filter serializes array", () => {
    const doc = makeDoc();
    const result = processTemplate(
      "{{ items | json }}",
      { documents: [doc], currentDoc: doc, variables: { items: ["x", "y"] } }
    );
    expect(result).toBe('["x","y"]');
  });

  it("keys filter returns object keys", () => {
    const doc = makeDoc();
    const result = processTemplate(
      "{% assign k = obj | keys %}{% for x in k %}{{x}} {% endfor %}",
      { documents: [doc], currentDoc: doc, variables: { obj: { a: 1, b: 2, c: 3 } } }
    );
    expect(result).toBe("a b c ");
  });

  it("keys filter passes non-object through", () => {
    const doc = makeDoc();
    const result = processTemplate(
      "{{ items | keys | json }}",
      { documents: [doc], currentDoc: doc, variables: { items: ["x", "y"] } }
    );
    expect(result).toBe('["x","y"]');
  });

  it("values filter returns object values", () => {
    const doc = makeDoc();
    const result = processTemplate(
      "{% assign v = obj | values %}{% for x in v %}{{x}} {% endfor %}",
      { documents: [doc], currentDoc: doc, variables: { obj: { a: "one", b: "two" } } }
    );
    expect(result).toBe("one two ");
  });

  it("values filter passes non-object through", () => {
    const doc = makeDoc();
    const result = processTemplate(
      "{{ items | values | json }}",
      { documents: [doc], currentDoc: doc, variables: { items: [1, 2] } }
    );
    expect(result).toBe("[1,2]");
  });
});
