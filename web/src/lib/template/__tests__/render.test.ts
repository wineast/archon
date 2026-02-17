import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  wikiDocuments: {
    id: "id",
    agentId: "agent_id",
    title: "title",
    content: "content",
    order: "order",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  lookupTables: { id: "id", key: "key", agentId: "agent_id" },
  lookupEntries: {
    tableId: "table_id",
    value: "value",
    label: "label",
    metadata: "metadata",
    order: "order",
  },
  dataObjects: { key: "key", agentId: "agent_id", data: "data" },
  templateVars: { key: "key", value: "value", type: "type", isArray: "is_array", agentId: "agent_id" },
  tools: {
    id: "id",
    agentId: "agent_id",
    name: "name",
    description: "description",
    parameters: "parameters",
    output: "output",
    handler: "handler",
    component: "component",
    enabled: "enabled",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
}));

vi.mock("@/lib/wiki/template", async () => {
  const { Liquid } = await import("liquidjs");
  const engine = new Liquid({ jsTruthy: true });
  return {
    processTemplate: vi.fn(
      (text: string, opts: { variables: Record<string, unknown> }) => {
        return engine.parseAndRenderSync(text, opts.variables);
      }
    ),
  };
});

vi.mock("@/lib/template-vars/queries", () => {
  function parseTemplateVarValue(value: string, type: string): unknown {
    switch (type) {
      case "number": return isNaN(parseFloat(value)) ? value : parseFloat(value);
      case "boolean": return value === "true";
      case "list":
      case "json":
        try { const p = JSON.parse(value); return type === "list" ? (Array.isArray(p) ? p : value) : p; } catch { return value; }
      default: return value;
    }
  }
  return {
    getTemplateVars: vi.fn(async () => {
      const { db } = await import("@/db");
      const rows = await (db.select as any)()
        .from()
        .where()
        .then((r: any[]) => r);
      const result: Record<string, unknown> = {};
      for (const row of rows) {
        result[row.key] = parseTemplateVarValue(row.value, row.type);
      }
      return result;
    }),
    parseTemplateVarValue,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock chain for db.select().from().where()...
 * Each "query" in the array corresponds to one db.select() call, in order.
 */
function setupDbChain(queries: unknown[][]) {
  let callIdx = 0;
  mockSelect.mockImplementation(() => {
    const rows = queries[callIdx] ?? [];
    callIdx++;
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows),
          orderBy: () => Promise.resolve(rows),
          then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
        }),
        then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty string as-is", async () => {
    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt("");
    expect(result).toBe("");
  });

  it("replaces active template variables", async () => {
    // Query order: getTemplateVars, getWikiDocs, getLookupVars
    setupDbChain([
      [{ key: "company", value: "Acme Corp", type: "text" }], // templateVars
      [],                                         // wikiDocuments (no docs)
      [],                                         // lookupTables (no tables)
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Welcome to {{company}}",
      "agent-1"
    );
    expect(result).toBe("Welcome to Acme Corp");
  });

  it("replaces built-in variables (date, year, etc)", async () => {
    setupDbChain([
      [],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Year: {{year}}, Date: {{date}}",
      "agent-1"
    );

    const now = new Date();
    expect(result).toContain(`Year: ${now.getFullYear()}`);
    expect(result).toContain(`Date: ${now.toISOString().slice(0, 10)}`);
  });

  it("replaces wiki built-in variables (currentDate, currentTime)", async () => {
    setupDbChain([
      [],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Today: {{currentDate}}",
      "agent-1"
    );
    // currentDate is provided by processTemplate's buildContext
    expect(result).toMatch(/Today: \d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("includes wiki documents via {% include %}", async () => {
    const now = new Date();
    setupDbChain([
      [],
      [
        {
          id: "faq-doc",
          title: "FAQ",
          content: "Q: What? A: This.",
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% include 'FAQ' %}",
      "agent-1"
    );
    expect(result).toBe("Q: What? A: This.");
  });

  it("resolves lookup table via lookup namespace", async () => {
    setupDbChain([
      [],
      [],
      // lookupTables
      [{ id: "lt-1", key: "states", type: "table", data: null }],
      // lookupEntries for "states"
      [
        { value: "CA", label: "California", metadata: null },
        { value: "TX", label: "Texas", metadata: null },
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "States: {{lookup.states}}",
      "agent-1"
    );
    expect(result).toBe("States: CA, TX");
  });

  it("resolves lookup table label variant via namespace", async () => {
    setupDbChain([
      [],
      [],
      [{ id: "lt-1", key: "products", type: "table", data: null }],
      [
        { value: "A", label: "Product A", metadata: null },
        { value: "B", label: "Product B", metadata: null },
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{lookup.products_label}}",
      "agent-1"
    );
    expect(result).toBe("Product A, Product B");
  });

  it("resolves lookup json variant via namespace", async () => {
    setupDbChain([
      [],
      [],
      [{ id: "lt-1", key: "items", type: "table", data: null }],
      [
        { value: "X", label: "Item X", metadata: null },
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{lookup.items_json}}",
      "agent-1"
    );
    expect(result).toBe(JSON.stringify([{ value: "X", label: "Item X", metadata: null }]));
  });

  it("supports {% for %} over lookup entries", async () => {
    setupDbChain([
      [],
      [],
      [{ id: "lt-1", key: "colors", type: "table", data: null }],
      [
        { value: "red", label: "Red", metadata: null },
        { value: "blue", label: "Blue", metadata: null },
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for entry in lookup.colors_entries %}{{entry.value}};{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("red;blue;");
  });

  it("lookup namespace does not conflict with template vars of the same name", async () => {
    setupDbChain([
      [{ key: "states", value: "custom-value", type: "text" }],
      [],
      [{ id: "lt-1", key: "states", type: "table", data: null }],
      [
        { value: "CA", label: "California", metadata: null },
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "var={{states}} lookup={{lookup.states}}",
      "agent-1"
    );
    expect(result).toBe("var=custom-value lookup=CA");
  });

  it("extraVars override active vars", async () => {
    setupDbChain([
      [{ key: "name", value: "Default", type: "text" }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Hello {{name}}",
      "agent-1",
      { name: "Override" }
    );
    expect(result).toBe("Hello Override");
  });

  it("passes eval-specific extraVars (model, caseCount)", async () => {
    setupDbChain([
      [],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Model: {{model}}, Cases: {{caseCount}}",
      "agent-1",
      { model: "gpt-4o", caseCount: 10 }
    );
    expect(result).toBe("Model: gpt-4o, Cases: 10");
  });

  it("returns original text on rendering failure", async () => {
    // Force an error by making getTemplateVars throw
    mockSelect.mockImplementation(() => {
      throw new Error("DB connection failed");
    });

    const { renderSystemPrompt } = await import("../render");
    const original = "Hello {{world}}";
    const result = await renderSystemPrompt(original, "agent-1");
    expect(result).toBe(original);
  });

  it("works without agentId (no template vars / wiki docs / lookup)", async () => {
    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt("{{greeting}} there!");
    // No agentId means no DB calls for template vars, so greeting is empty
    expect(result).toBe(" there!");
  });

  it("renders number type variable", async () => {
    setupDbChain([
      [{ key: "rate", value: "0.75", type: "number" }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Rate: {{rate}}",
      "agent-1"
    );
    expect(result).toBe("Rate: 0.75");
  });

  it("renders boolean type variable with {% if %}", async () => {
    setupDbChain([
      [{ key: "enabled", value: "true", type: "boolean" }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% if enabled %}ON{% else %}OFF{% endif %}",
      "agent-1"
    );
    expect(result).toBe("ON");
  });

  it("renders boolean false with {% if %}", async () => {
    setupDbChain([
      [{ key: "enabled", value: "false", type: "boolean" }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% if enabled %}ON{% else %}OFF{% endif %}",
      "agent-1"
    );
    expect(result).toBe("OFF");
  });

  it("renders isArray text variable with {% for %}", async () => {
    setupDbChain([
      [{ key: "langs", value: '["en","zh","es"]', type: "text", isArray: true }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for lang in langs %}{{lang}};{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("en;zh;es;");
  });

  it("renders isArray number variable", async () => {
    setupDbChain([
      [{ key: "scores", value: "[1,2,3]", type: "number", isArray: true }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for s in scores %}{{s}};{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("1;2;3;");
  });

  it("renders json type variable with field access", async () => {
    setupDbChain([
      [{ key: "office", value: '{"city":"LA","state":"CA"}', type: "json" }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{office.city}}, {{office.state}}",
      "agent-1"
    );
    expect(result).toBe("LA, CA");
  });

  it("falls back to raw string when isArray value is invalid JSON", async () => {
    setupDbChain([
      [{ key: "items", value: "not-json", type: "text", isArray: true }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Items: {{items}}",
      "agent-1"
    );
    expect(result).toBe("Items: not-json");
  });

  it("falls back to raw string when json type is invalid", async () => {
    setupDbChain([
      [{ key: "config", value: "{bad", type: "json" }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Config: {{config}}",
      "agent-1"
    );
    expect(result).toBe("Config: {bad");
  });

  it("returns empty string for missing lookup keys", async () => {
    setupDbChain([
      [],
      [],
      [], // no lookup tables
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Before {{missing}} after",
      "agent-1"
    );
    expect(result).toBe("Before  after");
  });
});

describe("renderWikiContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty string as-is", async () => {
    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent("", "agent-1", "doc-1");
    expect(result).toBe("");
  });

  it("renders wiki content with variables and includes", async () => {
    const now = new Date();
    setupDbChain([
      [{ key: "org", value: "TestOrg", type: "text" }],
      [
        {
          id: "doc-1",
          title: "Main",
          content: "Main doc",
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "doc-2",
          title: "Footer",
          content: "-- End --",
          order: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
      [],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "{{org}}\n{% include 'Footer' %}",
      "agent-1",
      "doc-1"
    );
    expect(result).toContain("TestOrg");
    expect(result).toContain("-- End --");
  });

  it("returns original content on failure", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("DB error");
    });

    const { renderWikiContent } = await import("../render");
    const original = "Some {{content}}";
    const result = await renderWikiContent(original, "agent-1", "doc-1");
    expect(result).toBe(original);
  });

  it("renders lookup entry value referencing template vars", async () => {
    setupDbChain([
      [{ key: "company", value: "Acme", type: "text" }],
      [],
      [{ id: "lt-1", key: "plans", type: "table", data: null }],
      [
        { value: "{{company}}_standard", label: "Standard Plan", metadata: null },
        { value: "{{company}}_premium", label: "Premium Plan", metadata: null },
      ],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "Plans: {{lookup.plans}}",
      "agent-1",
      "doc-1"
    );
    expect(result).toBe("Plans: Acme_standard, Acme_premium");
  });

  it("renders lookup entry label referencing template vars", async () => {
    setupDbChain([
      [{ key: "company", value: "Acme", type: "text" }],
      [],
      [{ id: "lt-1", key: "plans", type: "table", data: null }],
      [
        { value: "std", label: "{{company}} Standard", metadata: null },
      ],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "{{lookup.plans_label}}",
      "agent-1",
      "doc-1"
    );
    expect(result).toBe("Acme Standard");
  });

  it("renders lookup _json variant with resolved values", async () => {
    setupDbChain([
      [{ key: "company", value: "Acme", type: "text" }],
      [],
      [{ id: "lt-1", key: "plans", type: "table", data: null }],
      [
        { value: "{{company}}_plan", label: "{{company}} Plan", metadata: null },
      ],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "{{lookup.plans_json}}",
      "agent-1",
      "doc-1"
    );
    const parsed = JSON.parse(result);
    expect(parsed).toEqual([
      { value: "Acme_plan", label: "Acme Plan", metadata: null },
    ]);
  });

  it("renders lookup _entries variant with resolved values", async () => {
    setupDbChain([
      [{ key: "company", value: "Acme", type: "text" }],
      [],
      [{ id: "lt-1", key: "items", type: "table", data: null }],
      [
        { value: "{{company}}_a", label: "{{company}} A", metadata: null },
        { value: "{{company}}_b", label: "{{company}} B", metadata: null },
      ],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "{% for entry in lookup.items_entries %}{{entry.value}}-{{entry.label}};{% endfor %}",
      "agent-1",
      "doc-1"
    );
    expect(result).toBe("Acme_a-Acme A;Acme_b-Acme B;");
  });

  it("renders lookup entries referencing builtin vars like {{year}}", async () => {
    setupDbChain([
      [],
      [],
      [{ id: "lt-1", key: "editions", type: "table", data: null }],
      [
        { value: "edition_{{year}}", label: "Edition {{year}}", metadata: null },
      ],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "{{lookup.editions}}",
      "agent-1",
      "doc-1"
    );
    const year = String(new Date().getFullYear());
    expect(result).toBe(`edition_${year}`);
  });

  it("falls back to empty string for missing var in lookup entry", async () => {
    setupDbChain([
      [],
      [],
      [{ id: "lt-1", key: "items", type: "table", data: null }],
      [
        { value: "{{novar}}_suffix", label: null, metadata: null },
      ],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "{{lookup.items}}",
      "agent-1",
      "doc-1"
    );
    expect(result).toBe("_suffix");
  });

  it("leaves plain lookup entries unchanged (backward compat)", async () => {
    setupDbChain([
      [{ key: "company", value: "Acme", type: "text" }],
      [],
      [{ id: "lt-1", key: "colors", type: "table", data: null }],
      [
        { value: "red", label: "Red", metadata: null },
        { value: "blue", label: "Blue", metadata: null },
      ],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "{{lookup.colors}}",
      "agent-1",
      "doc-1"
    );
    expect(result).toBe("red, blue");
  });

  it("renders product-specific template variables from activeVars", async () => {
    const now = new Date();
    setupDbChain([
      [
        { key: "ocean_incomes", value: "Full Doc - W2 Wage Earner、NQM-WVOE", type: "text" },
        { key: "ocean_incomes_excluded", value: "NQM-DSCR", type: "text" },
        { key: "ocean_states", value: "CA, TX, NV", type: "text" },
      ],
      [
        {
          id: "wiki-uw-ocean",
          title: "Ocean",
          content: "合格：{{ocean_incomes}}。\n不合格：{{ocean_incomes_excluded}}。\n州：{{ocean_states}}。",
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
      [],
    ]);

    const { renderWikiContent } = await import("../render");
    const result = await renderWikiContent(
      "合格：{{ocean_incomes}}。\n不合格：{{ocean_incomes_excluded}}。\n州：{{ocean_states}}。",
      "agent-1",
      "wiki-uw-ocean"
    );
    expect(result).toContain("合格：Full Doc - W2 Wage Earner、NQM-WVOE。");
    expect(result).toContain("不合格：NQM-DSCR。");
    expect(result).toContain("州：CA, TX, NV。");
  });
});

// ---------------------------------------------------------------------------
// Tool namespace tests
// ---------------------------------------------------------------------------

describe("tool namespace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeTool = (name: string, description: string, parameters: unknown[] = []) => ({
    id: `tool-${name}`,
    agentId: "agent-1",
    name,
    description,
    parameters,
    output: null,
    handler: null,
    component: null,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("resolves tool.NAME.description to description", async () => {
    // Query order: templateVars, wikiDocs, lookupTables, dataObjects, tools
    setupDbChain([
      [], // templateVars
      [], // wikiDocs
      [], // lookupTables
      [], // dataObjects
      [makeTool("route_loan", "Route loan products to the best match")],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Tool: {{tool.route_loan.description}}",
      "agent-1"
    );
    expect(result).toBe("Tool: Route loan products to the best match");
  });

  it("resolves tool.NAME.name to tool name", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [makeTool("calculate_dti", "Calculate DTI ratio")],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{tool.calculate_dti.name}}",
      "agent-1"
    );
    expect(result).toBe("calculate_dti");
  });

  it("resolves tool.NAME.params to comma-separated param names", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [
        makeTool("calculate_dti", "Calculate DTI", [
          { id: "p1", name: "income", type: "number", description: "Monthly income", required: true },
          { id: "p2", name: "debts", type: "number", description: "Monthly debts", required: true },
        ]),
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Params: {{tool.calculate_dti.params}}",
      "agent-1"
    );
    expect(result).toBe("Params: income, debts");
  });

  it("resolves tool.NAME.json to JSON definition", async () => {
    const params = [
      { id: "p1", name: "amount", type: "number", description: "Loan amount", required: true },
    ];
    setupDbChain([
      [],
      [],
      [],
      [],
      [makeTool("calc_rate", "Calculate rate", params)],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{tool.calc_rate.json}}",
      "agent-1"
    );
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({
      name: "calc_rate",
      description: "Calculate rate",
      parameters: params,
    });
  });

  it("resolves tool.NAME.parameters for iteration", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [
        makeTool("calculate_dti", "Calculate DTI", [
          { id: "p1", name: "income", type: "number", description: "Monthly income", required: true },
          { id: "p2", name: "debts", type: "number", description: "Monthly debts", required: false },
        ]),
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for p in tool.calculate_dti.parameters %}{{p.name}}:{{p.type}};{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("income:number;debts:number;");
  });

  it("tool.NAME.parameters includes description and required", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [
        makeTool("calc", "Calculate", [
          { id: "p1", name: "amount", type: "number", description: "Loan amount", required: true },
          { id: "p2", name: "rate", type: "number", description: "Interest rate", required: false },
        ]),
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for p in tool.calc.parameters %}{{p.name}}({{p.description}},req={{p.required}});{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("amount(Loan amount,req=true);rate(Interest rate,req=false);");
  });

  it("tool.NAME.parameters includes enum when present", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [
        makeTool("route", "Route products", [
          { id: "p1", name: "type", type: "enum", description: "Product type", required: true, enum: ["A", "B", "C"] },
        ]),
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      '{% for p in tool.route.parameters %}{{p.enum | join: ","}}{% endfor %}',
      "agent-1"
    );
    expect(result).toBe("A,B,C");
  });

  it("resolves tool_names to comma-separated enabled tool names", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [
        makeTool("tool_a", "First tool"),
        makeTool("tool_b", "Second tool"),
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Tools: {{tool_names}}",
      "agent-1"
    );
    expect(result).toBe("Tools: tool_a, tool_b");
  });

  it("supports {% for %} over tool_entries", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [
        makeTool("search", "Search documents"),
        makeTool("lookup", "Lookup data"),
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for t in tool_entries %}{{t.name}}: {{t.description}};{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("search: Search documents;lookup: Lookup data;");
  });

  it("tool_entries includes simplified params", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [
        makeTool("calc", "Calculate", [
          { id: "p1", name: "x", type: "number", description: "X val", required: true },
          { id: "p2", name: "y", type: "string", description: "Y val", required: false },
        ]),
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for t in tool_entries %}{% for p in t.params %}{{p.name}}:{{p.type}};{% endfor %}{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("x:number;y:string;");
  });

  it("tool namespace does not conflict with lookup or template vars", async () => {
    setupDbChain([
      [{ key: "search", value: "custom-search", type: "text" }],
      [],
      [{ id: "lt-1", key: "search" }],
      [{ value: "web", label: "Web Search", metadata: null }],
      [], // dataObjects
      [makeTool("search", "Search tool description")],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "var={{search}} lookup={{lookup.search}} tool={{tool.search.description}}",
      "agent-1"
    );
    expect(result).toBe(
      "var=custom-search lookup=web tool=Search tool description"
    );
  });

  it("returns empty tool_names when no tools", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [], // no tools
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Tools: [{{tool_names}}]",
      "agent-1"
    );
    expect(result).toBe("Tools: []");
  });

  it("tool.NAME.params is empty string when tool has no parameters", async () => {
    setupDbChain([
      [],
      [],
      [],
      [],
      [makeTool("no_args_tool", "A tool with no args")],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Params: [{{tool.no_args_tool.params}}]",
      "agent-1"
    );
    expect(result).toBe("Params: []");
  });
});

// ---------------------------------------------------------------------------
// renderMetadataField + object type lookup tests
// ---------------------------------------------------------------------------

describe("renderMetadataField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders LiquidJS expressions inside metadata JSON", async () => {
    const { renderMetadataField } = await import("../render");
    const result = renderMetadataField(
      { label: "{{name}} Plan", count: 5 },
      { name: "Premium" }
    );
    expect(result).toEqual({ label: "Premium Plan", count: 5 });
  });

  it("returns original metadata when rendering fails", async () => {
    const { renderMetadataField } = await import("../render");
    // Circular reference can't be JSON.stringified but we pass a
    // non-circular object that might fail in LiquidJS
    const raw = { label: "{% invalid_tag %}" };
    const result = renderMetadataField(raw, {});
    // Should return original since LiquidJS will throw
    expect(result).toEqual(raw);
  });

  it("renders nested arrays and objects in metadata", async () => {
    const { renderMetadataField } = await import("../render");
    const result = renderMetadataField(
      {
        incomes: ["{{type_a}}", "{{type_b}}"],
        states: ["CA", "TX"],
      },
      { type_a: "Full Doc", type_b: "NQM" }
    );
    expect(result).toEqual({
      incomes: ["Full Doc", "NQM"],
      states: ["CA", "TX"],
    });
  });
});

describe("data object namespace (data.*)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves data object as nested object in template", async () => {
    setupDbChain([
      [], // templateVars
      [], // wikiDocs
      [], // lookupTables (empty)
      // dataObjects
      [{ key: "routes", data: {
        universe: { label: "Universe", states: ["CA", "TX"] },
        ocean: { label: "Ocean", states: ["NV"] },
      }}],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{data.routes.universe.label}}",
      "agent-1"
    );
    expect(result).toBe("Universe");
  });

  it("resolves data object states via join filter", async () => {
    setupDbChain([
      [],
      [],
      [],
      [{ key: "routes", data: {
        universe: { label: "Universe", states: ["CA", "TX", "NY"] },
      }}],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      '{{data.routes.universe.states | join: ", "}}',
      "agent-1"
    );
    expect(result).toBe("CA, TX, NY");
  });

  it("resolves data object _json variant", async () => {
    setupDbChain([
      [],
      [],
      [],
      [{ key: "products", data: {
        alpha: { label: "Alpha" },
      }}],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{data.products_json}}",
      "agent-1"
    );
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ alpha: { label: "Alpha" } });
  });

  it("resolves data object _entries as virtual entries", async () => {
    setupDbChain([
      [],
      [],
      [],
      [{ key: "products", data: {
        alpha: { label: "Alpha Product" },
        beta: { label: "Beta Product" },
      }}],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for e in data.products_entries %}{{e.value}}:{{e.label}};{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("alpha:Alpha Product;beta:Beta Product;");
  });

  it("renders LiquidJS expressions in data object", async () => {
    setupDbChain([
      [{ key: "product_name", value: "GMCC Universe", type: "text" }],
      [],
      [], // lookupTables (empty)
      // dataObjects
      [{ key: "routes", data: {
        universe: { label: "{{product_name}}", states: ["CA"] },
      }}],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{data.routes.universe.label}}",
      "agent-1"
    );
    expect(result).toBe("GMCC Universe");
  });

  it("table type metadata is rendered with LiquidJS expressions", async () => {
    setupDbChain([
      [{ key: "wiki_id", value: "wiki-uw-universe", type: "text" }],
      [],
      [{ id: "lt-1", key: "plans" }],
      [
        { value: "plan_a", label: "Plan A", metadata: { wikiId: "{{wiki_id}}" } },
      ],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for e in lookup.plans_entries %}{{e.metadata.wikiId}}{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("wiki-uw-universe");
  });
});
