import { describe, it, expect } from "vitest";
import { generateCompletions } from "../completions";

describe("generateCompletions", () => {
  const variables = ["company_name", "income_type_enum"];
  const documents = [{ title: "Company Policies" }];

  describe("basic trigger", () => {
    it("returns null when no {{ or {% is present", () => {
      expect(generateCompletions("hello world", variables, documents)).toBeNull();
    });

    it("returns null when {{ is already closed by }}", () => {
      expect(generateCompletions("{{done}} something", variables, documents)).toBeNull();
    });

    it("returns completions when {{ is open", () => {
      const result = generateCompletions("{{", variables, documents);
      expect(result).not.toBeNull();
      expect(result!.items.length).toBeGreaterThan(0);
    });

    it("returns completions when {% is open", () => {
      const result = generateCompletions("{%", variables, documents);
      expect(result).not.toBeNull();
      expect(result!.items.length).toBeGreaterThan(0);
    });
  });

  describe("variable completions", () => {
    it("includes dataset variable completions in {{ context", () => {
      const result = generateCompletions("{{", variables, documents);
      const labels = result!.items.map((o) => o.label);
      expect(labels).toContain("{{company_name}}");
      expect(labels).toContain("{{income_type_enum}}");
    });

    it("filters by typed text", () => {
      const result = generateCompletions("{{company", variables, documents);
      const labels = result!.items.map((o) => o.label);
      expect(labels).toContain("{{company_name}}");
      expect(labels).not.toContain("{{income_type_enum}}");
    });

    it("shows 'dataset' as detail", () => {
      const result = generateCompletions("{{", variables, documents);
      const item = result!.items.find(
        (o) => o.label === "{{company_name}}"
      );
      expect(item).toBeDefined();
      expect(item!.detail).toBe("dataset");
    });
  });

  describe("tool completions", () => {
    const tools = [{ name: "search", description: "Search tool" }];

    it("includes tool completions with nested variants", () => {
      const result = generateCompletions("{{", variables, documents, tools);
      const labels = result!.items.map((o) => o.label);
      expect(labels).toContain("{{tool.search.name}}");
      expect(labels).toContain("{{tool.search.description}}");
      expect(labels).toContain("{{tool.search.params}}");
      expect(labels).toContain("{{tool.search.parameters}}");
      expect(labels).toContain("{{tool.search.json}}");
    });

    it("includes top-level tool helpers", () => {
      const result = generateCompletions("{{", variables, documents, tools);
      const labels = result!.items.map((o) => o.label);
      expect(labels).toContain("{{tool_names}}");
      expect(labels).toContain("{{tool_entries}}");
    });
  });

  describe("document completions", () => {
    it("includes document completions (Liquid syntax)", () => {
      const result = generateCompletions("{{", variables, documents);
      const labels = result!.items.map((o) => o.label);
      expect(labels).toContain("{% include 'Company Policies' %}");
    });

    it("filters document completions by typed text", () => {
      const result = generateCompletions("{% include", variables, documents);
      const labels = result!.items.map((o) => o.label);
      expect(labels).toContain("{% include 'Company Policies' %}");
    });
  });

  describe("keyword completions", () => {
    it("includes keyword completions (Liquid syntax)", () => {
      const result = generateCompletions("{{", variables, documents);
      const labels = result!.items.map((o) => o.label);
      expect(labels).toContain("{% if ... %}");
      expect(labels).toContain("{% for ... %}");
      expect(labels).toContain("{% unless ... %}");
      expect(labels).toContain("{% else %}");
    });
  });

  describe("ordering", () => {
    it("variables have highest boost, then keywords, then documents", () => {
      const result = generateCompletions("{{", variables, documents);
      const items = result!.items;
      const varBoost = items.find(
        (o) => o.label === "{{company_name}}"
      )!.boost;
      const kwBoost = items.find(
        (o) => o.label === "{% if ... %}"
      )!.boost;
      const docBoost = items.find(
        (o) => o.label === "{% include 'Company Policies' %}"
      )!.boost;

      expect(varBoost).toBeGreaterThan(kwBoost);
      expect(kwBoost).toBeGreaterThan(docBoost);
    });
  });

  describe("edge cases", () => {
    it("works with no tools parameter (defaults to empty)", () => {
      const result = generateCompletions("{{", variables, documents);
      expect(result).not.toBeNull();
      const labels = result!.items.map((o) => o.label);
      expect(labels.some((l: string) => l.includes("tool."))).toBe(false);
    });

    it("returns null when all options are filtered out", () => {
      const result = generateCompletions("{{zzzzzzzzzzz", variables, documents);
      expect(result).toBeNull();
    });
  });
});
