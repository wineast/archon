import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import type { CompletionResult } from "@codemirror/autocomplete";
import { CompletionContext } from "@codemirror/autocomplete";
import { createCompletionSource } from "../completions";

/**
 * Invoke the source synchronously and narrow the return type.
 * Our completion source is always synchronous (never returns a Promise).
 */
function complete(
  source: ReturnType<typeof createCompletionSource>,
  text: string
): CompletionResult | null {
  const state = EditorState.create({ doc: text });
  const ctx = new CompletionContext(state, text.length, false);
  return source(ctx) as CompletionResult | null;
}

describe("createCompletionSource", () => {
  const variables = ["borrowerName", "propertyAddress"];
  const documents = [{ title: "Company Policies" }];
  const lookups = [
    { key: "property_state", name: "Property State" },
    { key: "loan_type" },
  ];

  const source = createCompletionSource(variables, documents, lookups);

  describe("basic trigger", () => {
    it("returns null when no {{ or {% is present", () => {
      expect(complete(source, "hello world")).toBeNull();
    });

    it("returns null when {{ is already closed by }}", () => {
      expect(complete(source, "{{done}} something")).toBeNull();
    });

    it("returns completions when {{ is open", () => {
      const result = complete(source, "{{");
      expect(result).not.toBeNull();
      expect(result!.options.length).toBeGreaterThan(0);
    });

    it("returns completions when {% is open", () => {
      const result = complete(source, "{%");
      expect(result).not.toBeNull();
      expect(result!.options.length).toBeGreaterThan(0);
    });
  });

  describe("variable completions", () => {
    it("includes variable completions in {{ context", () => {
      const result = complete(source, "{{");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{borrowerName}}");
      expect(labels).toContain("{{propertyAddress}}");
    });

    it("filters by typed text", () => {
      const result = complete(source, "{{borrower");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{borrowerName}}");
      expect(labels).not.toContain("{{propertyAddress}}");
    });
  });

  describe("lookup completions", () => {
    it("includes lookup completions with four variants per key (namespaced)", () => {
      const result = complete(source, "{{");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{lookup.property_state}}");
      expect(labels).toContain("{{lookup.property_state_label}}");
      expect(labels).toContain("{{lookup.property_state_json}}");
      expect(labels).toContain("{{lookup.property_state_entries}}");
      expect(labels).toContain("{{lookup.loan_type}}");
      expect(labels).toContain("{{lookup.loan_type_label}}");
      expect(labels).toContain("{{lookup.loan_type_json}}");
      expect(labels).toContain("{{lookup.loan_type_entries}}");
    });

    it("shows lookup name in detail", () => {
      const result = complete(source, "{{");
      const stateItem = result!.options.find(
        (o) => o.label === "{{lookup.property_state}}"
      );
      expect(stateItem).toBeDefined();
      expect(stateItem!.detail).toBe("Property State (values)");
    });

    it("uses key as detail fallback when name is not provided", () => {
      const result = complete(source, "{{");
      const loanItem = result!.options.find(
        (o) => o.label === "{{lookup.loan_type}}"
      );
      expect(loanItem).toBeDefined();
      expect(loanItem!.detail).toBe("loan_type (values)");
    });

    it("filters lookup completions by typed text", () => {
      const result = complete(source, "{{lookup.property");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{lookup.property_state}}");
      expect(labels).toContain("{{lookup.property_state_label}}");
      expect(labels).toContain("{{lookup.property_state_json}}");
      expect(labels).toContain("{{lookup.property_state_entries}}");
    });

    it("shows lookup items when typing partial key", () => {
      const result = complete(source, "{{lookup.loan");
      const labels = result!.options.map((o) => o.label);
      const lookupLabels = labels.filter((l: string) =>
        l.startsWith("{{lookup.loan_type")
      );
      expect(lookupLabels.length).toBeGreaterThan(0);
    });

    it("shows all lookup items when typing common prefix", () => {
      const result = complete(source, "{{");
      const labels = result!.options.map((o) => o.label);
      const lookupLabels = labels.filter(
        (l: string) =>
          l.startsWith("{{lookup.property_state") || l.startsWith("{{lookup.loan_type")
      );
      expect(lookupLabels.length).toBe(8); // 4 per key × 2 keys
    });
  });

  describe("document completions", () => {
    it("includes document completions (Liquid syntax)", () => {
      const result = complete(source, "{{");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{% include 'Company Policies' %}");
    });

    it("filters document completions by typed text", () => {
      const result = complete(source, "{% include");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{% include 'Company Policies' %}");
    });
  });

  describe("keyword completions", () => {
    it("includes keyword completions (Liquid syntax)", () => {
      const result = complete(source, "{{");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{% if ... %}");
      expect(labels).toContain("{% for ... %}");
      expect(labels).toContain("{% unless ... %}");
      expect(labels).toContain("{% else %}");
    });
  });

  describe("ordering", () => {
    it("variables have highest boost, then lookups, then keywords, then documents", () => {
      const result = complete(source, "{{");
      const options = result!.options;
      const varBoost = options.find(
        (o) => o.label === "{{borrowerName}}"
      )!.boost!;
      const lookupBoost = options.find(
        (o) => o.label === "{{lookup.property_state}}"
      )!.boost!;
      const kwBoost = options.find(
        (o) => o.label === "{% if ... %}"
      )!.boost!;
      const docBoost = options.find(
        (o) => o.label === "{% include 'Company Policies' %}"
      )!.boost!;

      expect(varBoost).toBeGreaterThan(lookupBoost);
      expect(lookupBoost).toBeGreaterThan(kwBoost);
      expect(kwBoost).toBeGreaterThan(docBoost);
    });
  });

  describe("edge cases", () => {
    it("works with empty lookups array", () => {
      const src = createCompletionSource(variables, documents, []);
      const result = complete(src, "{{");
      expect(result).not.toBeNull();
      const labels = result!.options.map((o) => o.label);
      expect(
        labels.some((l: string) => l.includes("_label}}") || l.includes("_json}}"))
      ).toBe(false);
    });

    it("works with no lookups parameter (defaults to empty)", () => {
      const src = createCompletionSource(variables, documents);
      const result = complete(src, "{{");
      expect(result).not.toBeNull();
      const labels = result!.options.map((o) => o.label);
      expect(
        labels.some((l: string) => l.includes("_label}}") || l.includes("_json}}"))
      ).toBe(false);
    });

    it("returns null when all options are filtered out", () => {
      const result = complete(source, "{{zzzzzzzzzzz");
      expect(result).toBeNull();
    });
  });
});
