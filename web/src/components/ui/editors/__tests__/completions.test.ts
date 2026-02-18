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
  const variables = ["company_name", "income_type_enum"];
  const documents = [{ title: "Company Policies" }];

  const source = createCompletionSource(variables, documents);

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
    it("includes dataset variable completions in {{ context", () => {
      const result = complete(source, "{{");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{company_name}}");
      expect(labels).toContain("{{income_type_enum}}");
    });

    it("filters by typed text", () => {
      const result = complete(source, "{{company");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{company_name}}");
      expect(labels).not.toContain("{{income_type_enum}}");
    });

    it("shows 'dataset' as detail", () => {
      const result = complete(source, "{{");
      const item = result!.options.find(
        (o) => o.label === "{{company_name}}"
      );
      expect(item).toBeDefined();
      expect(item!.detail).toBe("dataset");
    });
  });

  describe("tool completions", () => {
    const tools = [{ name: "search", description: "Search tool" }];
    const sourceWithTools = createCompletionSource(variables, documents, tools);

    it("includes tool completions with nested variants", () => {
      const result = complete(sourceWithTools, "{{");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{tool.search.name}}");
      expect(labels).toContain("{{tool.search.description}}");
      expect(labels).toContain("{{tool.search.params}}");
      expect(labels).toContain("{{tool.search.parameters}}");
      expect(labels).toContain("{{tool.search.json}}");
    });

    it("includes top-level tool helpers", () => {
      const result = complete(sourceWithTools, "{{");
      const labels = result!.options.map((o) => o.label);
      expect(labels).toContain("{{tool_names}}");
      expect(labels).toContain("{{tool_entries}}");
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
    it("variables have highest boost, then keywords, then documents", () => {
      const result = complete(source, "{{");
      const options = result!.options;
      const varBoost = options.find(
        (o) => o.label === "{{company_name}}"
      )!.boost!;
      const kwBoost = options.find(
        (o) => o.label === "{% if ... %}"
      )!.boost!;
      const docBoost = options.find(
        (o) => o.label === "{% include 'Company Policies' %}"
      )!.boost!;

      expect(varBoost).toBeGreaterThan(kwBoost);
      expect(kwBoost).toBeGreaterThan(docBoost);
    });
  });

  describe("edge cases", () => {
    it("works with no tools parameter (defaults to empty)", () => {
      const src = createCompletionSource(variables, documents);
      const result = complete(src, "{{");
      expect(result).not.toBeNull();
      const labels = result!.options.map((o) => o.label);
      expect(labels.some((l: string) => l.includes("tool."))).toBe(false);
    });

    it("returns null when all options are filtered out", () => {
      const result = complete(source, "{{zzzzzzzzzzz");
      expect(result).toBeNull();
    });
  });
});
