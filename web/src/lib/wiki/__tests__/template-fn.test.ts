import { describe, expect, it, vi, beforeEach } from "vitest";
import { processTemplate, type TemplateContext } from "../template";
import type { WikiDocument } from "../types";
import type { FunctionsSandbox } from "@/lib/functions/sandbox";

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

function makeCtx(
  doc: WikiDocument,
  documents: WikiDocument[] = [doc],
  variables?: Record<string, unknown>,
  fnSandbox?: FunctionsSandbox
): TemplateContext {
  return { documents, currentDoc: doc, variables, fnSandbox };
}

function makeSandbox(fns: Record<string, (input: unknown) => unknown>): FunctionsSandbox {
  return {
    keys: Object.keys(fns),
    call(key: string, input: unknown): unknown {
      const fn = fns[key];
      if (!fn) throw new Error(`Function "${key}" not found`);
      return fn(input);
    },
    dispose: vi.fn(),
  };
}

describe("processTemplate — function support", () => {
  describe("filter syntax: {{ input | fn_key }}", () => {
    it("calls function as filter and outputs result", () => {
      const sandbox = makeSandbox({
        double: (input: unknown) => (input as number) * 2,
      });
      const doc = makeDoc();
      const result = processTemplate(
        "Result: {{ num | double }}",
        makeCtx(doc, [doc], { num: 5 }, sandbox)
      );
      expect(result).toBe("Result: 10");
    });

    it("supports string return value", () => {
      const sandbox = makeSandbox({
        greet: (input: unknown) => `Hello, ${input}!`,
      });
      const doc = makeDoc();
      const result = processTemplate(
        "{{ name | greet }}",
        makeCtx(doc, [doc], { name: "World" }, sandbox)
      );
      expect(result).toBe("Hello, World!");
    });
  });

  describe("tag syntax: {% fn name input_var %}", () => {
    it("calls function with input variable", () => {
      const sandbox = makeSandbox({
        calculate_dti: (input: unknown) => {
          const data = input as { income: number; debt: number };
          return ((data.debt / data.income) * 100).toFixed(1);
        },
      });
      const doc = makeDoc();
      const result = processTemplate(
        "DTI: {% fn calculate_dti my_data %}%",
        makeCtx(doc, [doc], { my_data: { income: 5000, debt: 1500 } }, sandbox)
      );
      expect(result).toBe("DTI: 30.0%");
    });

    it("calls function without input (undefined)", () => {
      const sandbox = makeSandbox({
        get_config: () => "default_config",
      });
      const doc = makeDoc();
      const result = processTemplate(
        "Config: {% fn get_config %}",
        makeCtx(doc, [doc], {}, sandbox)
      );
      expect(result).toBe("Config: default_config");
    });

    it("serializes object result as JSON", () => {
      const sandbox = makeSandbox({
        get_data: () => ({ a: 1, b: 2 }),
      });
      const doc = makeDoc();
      const result = processTemplate(
        "{% fn get_data %}",
        makeCtx(doc, [doc], {}, sandbox)
      );
      expect(result).toBe('{"a":1,"b":2}');
    });
  });

  describe("chained filters: {{ data | fn_a | fn_b }}", () => {
    it("chains multiple function filters", () => {
      const sandbox = makeSandbox({
        add_one: (input: unknown) => (input as number) + 1,
        multiply_two: (input: unknown) => (input as number) * 2,
      });
      const doc = makeDoc();
      const result = processTemplate(
        "{{ num | add_one | multiply_two }}",
        makeCtx(doc, [doc], { num: 3 }, sandbox)
      );
      // (3 + 1) * 2 = 8
      expect(result).toBe("8");
    });
  });

  describe("assign with function: {% assign result = data | fn_key %}", () => {
    it("assigns function result to variable", () => {
      const sandbox = makeSandbox({
        uppercase: (input: unknown) => String(input).toUpperCase(),
      });
      const doc = makeDoc();
      const result = processTemplate(
        "{% assign result = name | uppercase %}Name: {{result}}",
        makeCtx(doc, [doc], { name: "hello" }, sandbox)
      );
      expect(result).toBe("Name: HELLO");
    });
  });

  describe("error handling", () => {
    it("filter returns empty string on runtime error", () => {
      const sandbox = makeSandbox({
        broken: () => { throw new Error("boom"); },
      });
      const doc = makeDoc();
      const result = processTemplate(
        "Before {{ val | broken }} After",
        makeCtx(doc, [doc], { val: "test" }, sandbox)
      );
      expect(result).toBe("Before  After");
    });

    it("{% fn %} tag returns empty string on runtime error", () => {
      const sandbox = makeSandbox({
        broken_fn: () => { throw new Error("boom"); },
      });
      const doc = makeDoc();
      const result = processTemplate(
        "Before {% fn broken_fn %} After",
        makeCtx(doc, [doc], {}, sandbox)
      );
      expect(result).toBe("Before  After");
    });
  });

  describe("backward compatibility", () => {
    it("renders normally without fnSandbox", () => {
      const doc = makeDoc({ name: "Hello" });
      const result = processTemplate(
        "Title: {{documentTitle}}, Var: {{x}}",
        makeCtx(doc, [doc], { x: "42" })
      );
      expect(result).toBe("Title: Hello, Var: 42");
    });

    it("renders normally with empty sandbox (no functions)", () => {
      const sandbox = makeSandbox({});
      const doc = makeDoc({ name: "Hello" });
      const result = processTemplate(
        "Title: {{documentTitle}}",
        makeCtx(doc, [doc], {}, sandbox)
      );
      expect(result).toBe("Title: Hello");
    });
  });
});
