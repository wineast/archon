import { describe, it, expect } from "vitest";
import { executeToolInSandbox } from "../sandbox";
import type { ToolContext, WikiDoc } from "../tool-context";

/**
 * Test that QuickJS async sandbox correctly handles `Promise.all`
 * with asyncified host callbacks — the pattern used by route_loan_products.
 */

function createMockContext(datasetData: Record<string, unknown>): ToolContext {
  return {
    wiki: {
      async get(_id: string): Promise<WikiDoc | null> {
        return { meta: null, content: `(wiki stub for ${_id})` };
      },
      async findByPrefix() {
        return [];
      },
      async search() {
        return [];
      },
    },
    dataset: {
      async get(key: string) {
        return datasetData[key] ?? null;
      },
    },
    async fn(_key: string) {
      throw new Error(`Function "${_key}" not found`);
    },
    ontology: {
      async types() { return []; },
      async type() { return null; },
      async query() { return []; },
      async get() { return null; },
      async create() { return { id: "", label: "" }; },
      async update() { return { id: "", label: "" }; },
      async delete() { return { ok: true }; },
      async link() { return { id: "" }; },
      async unlink() { return { ok: true }; },
      async graph() { return { nodes: [], edges: [] }; },
    },
  };
}

describe("QuickJS sandbox: Promise.all with asyncified callbacks", () => {
  it("handles simple sequential await", async () => {
    const context = createMockContext({
      hello: { greeting: "world" },
    });

    const code = `
import { dataset } from "archon:context";
export default async function(args) {
  const data = await dataset.get("hello");
  return { result: data.greeting };
}`;

    const result = await executeToolInSandbox(code, {}, context);
    expect(result).toEqual({ result: "world" });
  });

  it("handles Object.entries on asyncified result", async () => {
    const context = createMockContext({
      items: { a: "Alpha", b: "Beta" },
    });

    const code = `
import { dataset } from "archon:context";
export default async function(args) {
  const data = await dataset.get("items");
  const entries = Object.entries(data);
  return { count: entries.length };
}`;

    const result = await executeToolInSandbox(code, {}, context);
    expect(result).toEqual({ count: 2 });
  });

  it("handles nested object with arrays", async () => {
    const context = createMockContext({
      routes: {
        product_a: {
          label: "Product A",
          items: ["W2", "Self-Employed"],
        },
      },
    });

    const code = `
import { dataset } from "archon:context";
export default async function(args) {
  const data = await dataset.get("routes");
  const pa = data.product_a;
  return { label: pa.label, isArr: Array.isArray(pa.items), len: pa.items.length };
}`;

    const result = await executeToolInSandbox(code, {}, context);
    expect(result).toEqual({ label: "Product A", isArr: true, len: 2 });
  });

  it("handles Array.includes on marshaled arrays", async () => {
    const context = createMockContext({
      routes: {
        product_a: {
          incomes: ["W2", "Self-Employed"],
          states: ["CA", "TX"],
        },
      },
    });

    const code = `
import { dataset } from "archon:context";
export default async function({ income, state }) {
  const data = await dataset.get("routes");
  const pa = data.product_a;
  const incomes = pa.incomes;
  const states = pa.states;
  const isIncArray = Array.isArray(incomes);
  const isStArray = Array.isArray(states);
  const hasIncome = incomes.includes(income);
  const hasState = states.includes(state);
  return { isIncArray, isStArray, hasIncome, hasState };
}`;

    const result = await executeToolInSandbox(
      code,
      { income: "W2", state: "CA" },
      context
    );
    expect(result).toEqual({ isIncArray: true, isStArray: true, hasIncome: true, hasState: true });
  });

  it("handles for...of loop with Object.entries", async () => {
    const context = createMockContext({
      routes: {
        product_a: {
          label: "Product A",
          incomes: ["W2", "Self-Employed"],
          states: ["CA", "TX"],
        },
        product_b: {
          label: "Product B",
          incomes: ["W2"],
          states: ["FL"],
        },
      },
    });

    const code = `
import { dataset } from "archon:context";
export default async function({ income, state }) {
  const routesObj = await dataset.get("routes");
  const routes = Object.entries(routesObj || {}).map(([k, v]) => ({
    value: k,
    label: v.label || null,
    metadata: v,
  }));
  const matched = [];
  for (const r of routes) {
    const incomes = r.metadata.incomes;
    const states = r.metadata.states;
    if (!Array.isArray(incomes) || !Array.isArray(states)) continue;
    if (incomes.includes(income) && states.includes(state)) matched.push(r);
  }
  return { matched_count: matched.length, products: matched.map(r => r.label) };
}`;

    const result = await executeToolInSandbox(
      code,
      { income: "W2", state: "CA" },
      context
    ) as { matched_count: number; products: string[] };
    expect(result.matched_count).toBe(1);
    expect(result.products).toEqual(["Product A"]);
  });

  it("handles Promise.all with asyncified callbacks (wiki.get)", async () => {
    const context = createMockContext({
      items: { a: { name: "Alpha" }, b: { name: "Beta" } },
    });

    const code = `
import { dataset, wiki } from "archon:context";
export default async function(args) {
  const items = await dataset.get("items");
  const keys = Object.keys(items);
  const results = await Promise.all(keys.map(async (k) => {
    const doc = await wiki.get(k);
    return { key: k, name: items[k].name, doc: doc.content };
  }));
  return { count: results.length, results };
}`;

    const result = await executeToolInSandbox(code, {}, context) as {
      count: number;
      results: Array<{ key: string; name: string; doc: string }>;
    };
    expect(result.count).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.find((r) => r.key === "a")?.name).toBe("Alpha");
  });

  it("handles full route_loan_products pattern", async () => {
    const context = createMockContext({
      product_routes: {
        ocean: {
          label: "GMCC Ocean",
          states: ["CA", "TX"],
          wikiId: "wiki-ocean",
          incomes: ["Self-Employed", "Bank Statement"],
        },
        thunder: {
          label: "GMCC Thunder",
          states: ["CA", "TX"],
          wikiId: "wiki-thunder",
          incomes: ["W2"],
        },
      },
    });

    const code = `
import { dataset, wiki } from "archon:context";
export default async function({ income_type, property_state }) {
  const routesObj = await dataset.get("product_routes");
  const routes = Object.entries(routesObj || {}).map(([k, v]) => ({
    value: k,
    label: v?.label || null,
    metadata: v,
  }));
  const state = property_state.toUpperCase().trim();
  const income = income_type.trim();
  const matched = [];
  for (const r of routes) {
    const incomes = r.metadata?.incomes;
    const states = r.metadata?.states;
    if (!Array.isArray(incomes) || !Array.isArray(states)) continue;
    if (incomes.includes(income) && states.includes(state)) matched.push(r);
  }
  if (matched.length === 0) {
    return { matched_count: 0, products: [], message: "No match" };
  }
  const products = await Promise.all(matched.map(async (r) => {
    const doc = await wiki.get(r.metadata.wikiId);
    return {
      product_name: r.label || r.value,
      content: doc?.content || "no doc",
    };
  }));
  return { matched_count: products.length, products };
}`;

    const result = await executeToolInSandbox(
      code,
      { income_type: "W2", property_state: "CA" },
      context
    ) as { matched_count: number; products: Array<{ product_name: string; content: string }> };

    expect(result.matched_count).toBe(1);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].product_name).toBe("GMCC Thunder");
    expect(result.products[0].content).toContain("wiki stub");
  });
});
