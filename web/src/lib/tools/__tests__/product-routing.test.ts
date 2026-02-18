import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { DataEntry, ToolContext, WikiDoc } from "../tool-context";
import { resolveDatasets } from "@/lib/datasets/queries";

// ── Load seed data ──
const seedDir = path.resolve(__dirname, "../../../db/seed-data/gmcc-advisor");

const allDatasets = JSON.parse(
  fs.readFileSync(path.join(seedDir, "datasets.json"), "utf8")
) as Array<{ key: string; layer: number; data: unknown }>;

const tools = JSON.parse(
  fs.readFileSync(path.join(seedDir, "tools.json"), "utf8")
) as Array<{ name: string; handler: string }>;

// ── Resolve datasets (layer 0 + layer 1) ──
const { resolvedVars } = resolveDatasets(allDatasets);
const productRoutes = resolvedVars.product_routes as Record<
  string,
  Record<string, unknown>
>;

const mockDataEntries: DataEntry[] = Object.entries(productRoutes).map(
  ([key, val]) => ({
    value: key,
    label: (val.label as string) ?? null,
    metadata: val,
  })
);

// ── Eval the real handler from tools.json ──
const handlerSource = tools.find((t) => t.name === "route_loan_products")!.handler;

// eslint-disable-next-line no-eval
const handlerFn = eval(`(${handlerSource})`) as (
  args: { income_type: string; property_state: string },
  context: ToolContext
) => Promise<{
  matched_count: number;
  products: Array<{ product_name: string }>;
}>;

// ── Mock context ──
const mockContext = {
  wiki: {
    async get(_id: string): Promise<WikiDoc> {
      return { meta: null, content: "(wiki content stub)" };
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
      return resolvedVars[key] ?? null;
    },
    async getEntries(key: string) {
      const val = resolvedVars[key];
      if (!val || typeof val !== "object" || Array.isArray(val)) return [];
      return Object.entries(val as Record<string, unknown>).map(([k, v]) => ({
        value: k,
        label: ((v as Record<string, unknown>)?.label as string | null) ?? null,
        metadata: v as Record<string, unknown>,
      }));
    },
  },
} satisfies ToolContext;

// ── Helper: call real handler, return sorted product keys ──
async function routeProducts(
  incomeType: string,
  state: string
): Promise<string[]> {
  const result = await handlerFn(
    { income_type: incomeType, property_state: state },
    mockContext
  );
  return result.products
    .map((p) => {
      // Reverse-lookup: find key by label
      const entry = mockDataEntries.find((e) => e.label === p.product_name);
      return entry?.value ?? p.product_name;
    })
    .sort();
}

// ── Test cases ──
interface RoutingCase {
  name: string;
  incomeType: string;
  state: string;
  expected: string[];
  exclusive?: boolean;
}

const cases: RoutingCase[] = [
  {
    name: "Case 1: Purchase Investment Condo US Citizen CA + Borrower P&L",
    incomeType: "NQM-Borrower Prepared P&L",
    state: "CA",
    expected: ["universe", "ocean", "hermes_ca", "radiant_cra", "radiant_portfolio"],
    exclusive: true,
  },
  {
    name: "Case 2: Cash-Out Primary Condo US Citizen TX + Borrower P&L",
    incomeType: "NQM-Borrower Prepared P&L",
    state: "TX",
    expected: ["universe", "ocean", "hermes_non_ca"],
    exclusive: true,
  },
  {
    name: "Case 3: Cash-Out Primary Condo US Citizen GA + Borrower P&L",
    incomeType: "NQM-Borrower Prepared P&L",
    state: "GA",
    expected: ["universe", "hermes_non_ca"],
    exclusive: true,
  },
  {
    name: "Case 4: Cash-Out Primary Condo FN CA + CPA P&L",
    incomeType: "NQM-CPA Prepared P&L",
    state: "CA",
    expected: ["universe", "ocean", "hermes_ca", "radiant_cra", "radiant_portfolio"],
    exclusive: true,
  },
  {
    name: "Case 5: Cash-Out Primary Condo F1 FL + W2",
    incomeType: "Full Doc - W2 Wage Earner",
    state: "FL",
    expected: ["fabulous"],
    exclusive: true,
  },
  {
    name: "Case 6: Purchase Primary SFR US Citizen CA + No Ratio",
    incomeType: "No Ratio - No Job/No DTI-DTA",
    state: "CA",
    expected: ["universe", "radiant_au"],
    exclusive: true,
  },
  {
    name: "Case 7: Cash-Out Primary Condo FN CA + Asset Depletion",
    incomeType: "No Ratio - Asset Depletion/Utilization",
    state: "CA",
    expected: ["universe", "radiant_au"],
    exclusive: true,
  },
  {
    name: "Case 8: Rate/Term Primary Condo US Citizen HI + Asset Depletion",
    incomeType: "No Ratio - Asset Depletion/Utilization",
    state: "HI",
    expected: ["radiant_au"],
    exclusive: true,
  },
  {
    name: "Case 9: Cash-Out Investment PUD FN WA + Self Employed",
    incomeType: "NQM - 1year of 2-years Full Doc-Self-employed",
    state: "WA",
    expected: ["universe", "hermes_non_ca"],
    exclusive: true,
  },
  {
    name: "Case 10: Cash-Out Primary 2-4 Units US Citizen CA + Self Employed",
    incomeType: "NQM - 1year of 2-years Full Doc-Self-employed",
    state: "CA",
    expected: ["universe", "ocean", "hermes_ca", "radiant_cra", "radiant_portfolio"],
    exclusive: true,
  },
  {
    name: "Case 12: Cash-Out Primary Condo F1 CA + W2",
    incomeType: "Full Doc - W2 Wage Earner",
    state: "CA",
    expected: ["thunder", "celebrity"],
    exclusive: true,
  },
  {
    name: "New Case 1: Rate/Term Primary Condo US Citizen TX + Bank Statements",
    incomeType: "NQM 12/24mo Bank Statements",
    state: "TX",
    expected: ["universe", "ocean", "hermes_non_ca"],
    exclusive: true,
  },
  {
    name: "New Case 2: Cash-Out Primary Condo US Citizen AK + Borrower P&L",
    incomeType: "NQM-Borrower Prepared P&L",
    state: "AK",
    expected: [],
    exclusive: true,
  },
  {
    name: "New Case 3: Purchase Primary SFR US Citizen CA + WVOE",
    incomeType: "NQM-WVOE",
    state: "CA",
    expected: ["universe", "ocean", "hermes_ca", "radiant_cra", "radiant_portfolio"],
    exclusive: true,
  },
  {
    name: "New Case 4: Rate/Term Primary Condo US Citizen MA + 1099",
    incomeType: "NQM - 1-2yr 1099",
    state: "MA",
    expected: ["universe"],
    exclusive: true,
  },
];

// ── Tests ──
describe("Product routing — eval real handler", () => {
  it.each(cases)("$name", async ({ incomeType, state, expected, exclusive }) => {
    const actual = await routeProducts(incomeType, state);
    const expectedSorted = [...expected].sort();

    // 期望的产品必须全部命中
    for (const product of expectedSorted) {
      expect(actual, `Missing expected product: ${product}`).toContain(product);
    }

    // exclusive 模式：不允许多余的产品
    if (exclusive) {
      expect(actual).toEqual(expectedSorted);
    }
  });
});
