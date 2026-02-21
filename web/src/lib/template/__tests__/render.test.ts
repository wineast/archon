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
  datasets: {
    key: "key",
    name: "name",
    data: "data",
    agentId: "agent_id",
    id: "id",
    deletedAt: "deleted_at",
  },
  wikiDocuments: {
    id: "id",
    agentId: "agent_id",
    content: "content",
    order: "order",
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
  tools: {
    id: "id",
    agentId: "agent_id",
    name: "name",
    description: "description",
    parametersSchema: "parameters_schema",
    returnParametersSchema: "return_parameters_schema",
    output: "output",
    handler: "handler",
    component: "component",
    enabled: "enabled",
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
  schemas: {
    id: "id",
    agentId: "agent_id",
    key: "key",
    name: "name",
    parameters: "parameters",
    deletedAt: "deleted_at",
  },
  objectTypes: {
    id: "id",
    agentId: "agent_id",
    key: "key",
    name: "name",
    order: "order",
    deletedAt: "deleted_at",
  },
  objectRelations: {
    id: "id",
    agentId: "agent_id",
    deletedAt: "deleted_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  inArray: vi.fn((a, b) => ({ op: "inArray", a, b })),
  asc: vi.fn((a) => ({ op: "asc", a })),
  isNull: vi.fn((a) => ({ op: "isNull", a })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock chain for db.select().from().where()...
 * gatherTemplateData issues queries in this order:
 *   [0] datasets rows       — getResolvedDatasets → getDatasets
 *   [1] wiki doc rows       — getWikiDocs
 *   [2] tool rows           — getEnabledTools
 *   [3] objectTypes rows    — ontology types
 *   [4] objectRelations rows — ontology relations
 *   [5] all schema rows     — for resolveParameters
 *
 * For convenience, pass 3 items and the helper fills the rest with [].
 */
function setupDbChain(queries: unknown[][]) {
  // Auto-fill missing trailing queries with empty arrays
  while (queries.length < 6) queries.push([]);
  let callIdx = 0;
  mockSelect.mockImplementation(() => {
    const rows = queries[callIdx] ?? [];
    callIdx++;
    return {
      from: () => ({
        where: () => ({
          limit: () => ({
            then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
          }),
          orderBy: () => ({
            then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
          }),
          then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
        }),
        then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(rows)),
      }),
    };
  });
}

/**
 * Build a mock schema row. Accepts either:
 * - a JsonSchema7 object (new format)
 * - an array of { name, type, description, required, enum? } for convenience (auto-converted)
 */
const makeSchemaRow = (id: string, params: unknown) => {
  // If params is an array (legacy convenience), convert to JsonSchema7
  let parameters: Record<string, unknown>;
  if (Array.isArray(params)) {
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];
    for (const p of params as Array<{ name: string; type: string; description?: string; required?: boolean; enum?: string[] }>) {
      const prop: Record<string, unknown> = { type: p.type, description: p.description ?? "" };
      if (p.enum) prop.enum = p.enum;
      properties[p.name] = prop;
      if (p.required) required.push(p.name);
    }
    parameters = { type: "object", properties, required };
  } else {
    parameters = params as Record<string, unknown>;
  }
  return {
    id,
    agentId: "agent-1",
    key: id,
    name: id,
    parameters,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

const makeTool = (name: string, description: string, parametersSchema: Record<string, unknown> | null = null) => ({
  id: `tool-${name}`,
  agentId: "agent-1",
  name,
  description,
  parametersSchema,
  returnParametersSchema: null,
  output: null,
  handler: null,
  component: null,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ---------------------------------------------------------------------------
// Tests — renderSystemPrompt
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

  it("replaces dataset variables", async () => {
    setupDbChain([
      [{ key: "company",data: "Acme Corp" }],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Welcome to {{company}}",
      "agent-1"
    );
    expect(result).toBe("Welcome to Acme Corp");
  });

  it("replaces built-in variables (date, year, etc)", async () => {
    setupDbChain([[], [], []]);

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
    setupDbChain([[], [], []]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Today: {{currentDate}}",
      "agent-1"
    );
    expect(result).toMatch(/Today: \d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("includes wiki documents via {% include %}", async () => {
    const now = new Date();
    setupDbChain([
      [],
      [
        {
          id: "faq-doc",
          key: "faq",
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
      "{% include 'faq' %}",
      "agent-1"
    );
    expect(result).toBe("Q: What? A: This.");
  });

  it("accesses object dataset properties", async () => {
    setupDbChain([
      [
        {
          key: "state_enum",
          data: { CA: "California", TX: "Texas" },
        },
      ],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "State: {{state_enum.CA}}",
      "agent-1"
    );
    expect(result).toBe("State: California");
  });

  it("extraVars override dataset vars", async () => {
    setupDbChain([
      [{ key: "name",data: "Default" }],
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
    setupDbChain([[], [], []]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Model: {{model}}, Cases: {{caseCount}}",
      "agent-1",
      { model: "gpt-4o", caseCount: 10 }
    );
    expect(result).toBe("Model: gpt-4o, Cases: 10");
  });

  it("returns original text on rendering failure", async () => {
    const err = new Error("DB connection failed");
    function rejectThenable() {
      const t = {
        from: () => t,
        where: () => t,
        orderBy: () => t,
        limit: () => t,
        then: (_res: unknown, rej: (e: Error) => void) => { rej(err); },
      };
      return t;
    }
    mockSelect.mockImplementation(rejectThenable);

    const { renderSystemPrompt } = await import("../render");
    const original = "Hello {{world}}";
    const result = await renderSystemPrompt(original, "agent-1");
    expect(result).toBe(original);
  });

  it("works without agentId (no dataset vars / wiki docs)", async () => {
    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt("{{greeting}} there!");
    expect(result).toBe(" there!");
  });

  it("renders numeric dataset value", async () => {
    setupDbChain([
      [{ key: "rate",data: 0.75 }],
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

  it("renders boolean dataset with {% if %}", async () => {
    setupDbChain([
      [{ key: "enabled",data: true }],
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
      [{ key: "enabled",data: false }],
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

  it("renders array dataset with {% for %}", async () => {
    setupDbChain([
      [{ key: "langs",data: ["en", "zh", "es"] }],
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

  it("renders array of numbers with {% for %}", async () => {
    setupDbChain([
      [{ key: "scores",data: [1, 2, 3] }],
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

  it("renders object dataset with field access", async () => {
    setupDbChain([
      [{ key: "office",data: { city: "LA", state: "CA" } }],
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

  it("returns empty string for missing variables", async () => {
    setupDbChain([[], [], []]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Before {{missing}} after",
      "agent-1"
    );
    expect(result).toBe("Before  after");
  });

  it("resolves derived dataset with base dataset references", async () => {
    setupDbChain([
      [
        { key: "product_name",data: "GMCC Universe" },
        {
          key: "routes",
         
          data: { universe: { label: "{{product_name}}", states: ["CA"] } },
        },
      ],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{{routes.universe.label}}",
      "agent-1"
    );
    expect(result).toBe("GMCC Universe");
  });

  it("resolves dataset states via join filter", async () => {
    setupDbChain([
      [
        {
          key: "routes",
          data: { universe: { label: "Universe", states: ["CA", "TX", "NY"] } },
        },
      ],
      [],
      [],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      '{{routes.universe.states | join: ", "}}',
      "agent-1"
    );
    expect(result).toBe("CA, TX, NY");
  });
});

// ---------------------------------------------------------------------------
// Tests — renderWikiContent
// ---------------------------------------------------------------------------

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
      [{ key: "org",data: "TestOrg" }],
      [
        {
          id: "doc-1",
          key: "main",
          title: "Main",
          content: "Main doc",
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "doc-2",
          key: "footer",
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
      "{{org}}\n{% include 'footer' %}",
      "agent-1",
      "doc-1"
    );
    expect(result).toContain("TestOrg");
    expect(result).toContain("-- End --");
  });

  it("returns original content on failure", async () => {
    const err = new Error("DB error");
    function rejectThenable() {
      const t = {
        from: () => t,
        where: () => t,
        orderBy: () => t,
        limit: () => t,
        then: (_res: unknown, rej: (e: Error) => void) => { rej(err); },
      };
      return t;
    }
    mockSelect.mockImplementation(rejectThenable);

    const { renderWikiContent } = await import("../render");
    const original = "Some {{content}}";
    const result = await renderWikiContent(original, "agent-1", "doc-1");
    expect(result).toBe(original);
  });

  it("renders product-specific dataset variables", async () => {
    const now = new Date();
    setupDbChain([
      [
        { key: "ocean_incomes",data: "Full Doc - W2 Wage Earner、NQM-WVOE" },
        { key: "ocean_incomes_excluded",data: "NQM-DSCR" },
        { key: "ocean_states",data: "CA, TX, NV" },
      ],
      [
        {
          id: "wiki-uw-ocean",
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
// Tests — tool namespace
// ---------------------------------------------------------------------------

describe("tool namespace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves tool.NAME.description to description", async () => {
    setupDbChain([
      [],
      [],
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
    const schema = {
      type: "object",
      properties: {
        income: { type: "number", description: "Monthly income" },
        debts: { type: "number", description: "Monthly debts" },
      },
      required: ["income", "debts"],
    };
    setupDbChain([
      [],
      [],
      [makeTool("calculate_dti", "Calculate DTI", schema)],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "Params: {{tool.calculate_dti.params}}",
      "agent-1"
    );
    expect(result).toBe("Params: income, debts");
  });

  it("resolves tool.NAME.json to JSON definition", async () => {
    const schema = {
      type: "object",
      properties: {
        amount: { type: "number", description: "Loan amount" },
      },
      required: ["amount"],
    };
    setupDbChain([
      [],
      [],
      [makeTool("calc_rate", "Calculate rate", schema)],
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
      parameters: schema,
    });
  });

  it("resolves tool.NAME.parameters for iteration", async () => {
    const schema = {
      type: "object",
      properties: {
        income: { type: "number", description: "Monthly income" },
        debts: { type: "number", description: "Monthly debts" },
      },
      required: ["income"],
    };
    setupDbChain([
      [],
      [],
      [makeTool("calculate_dti", "Calculate DTI", schema)],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for p in tool.calculate_dti.parameters %}{{p.name}}:{{p.type}};{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("income:number;debts:number;");
  });

  it("tool.NAME.parameters includes description and required", async () => {
    const schema = {
      type: "object",
      properties: {
        amount: { type: "number", description: "Loan amount" },
        rate: { type: "number", description: "Interest rate" },
      },
      required: ["amount"],
    };
    setupDbChain([
      [],
      [],
      [makeTool("calc", "Calculate", schema)],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for p in tool.calc.parameters %}{{p.name}}({{p.description}},req={{p.required}});{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("amount(Loan amount,req=true);rate(Interest rate,req=false);");
  });

  it("tool.NAME.parameters includes enum when present", async () => {
    const schema = {
      type: "object",
      properties: {
        type: { type: "enum", description: "Product type", enum: ["A", "B", "C"] },
      },
      required: ["type"],
    };
    setupDbChain([
      [],
      [],
      [makeTool("route", "Route products", schema)],
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
    const schema = {
      type: "object",
      properties: {
        x: { type: "number", description: "X val" },
        y: { type: "string", description: "Y val" },
      },
      required: ["x"],
    };
    setupDbChain([
      [],
      [],
      [makeTool("calc", "Calculate", schema)],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "{% for t in tool_entries %}{% for p in t.params %}{{p.name}}:{{p.type}};{% endfor %}{% endfor %}",
      "agent-1"
    );
    expect(result).toBe("x:number;y:string;");
  });

  it("tool namespace does not conflict with dataset vars", async () => {
    setupDbChain([
      [{ key: "search",data: "custom-search" }],
      [],
      [makeTool("search", "Search tool description")],
    ]);

    const { renderSystemPrompt } = await import("../render");
    const result = await renderSystemPrompt(
      "var={{search}} tool={{tool.search.description}}",
      "agent-1"
    );
    expect(result).toBe(
      "var=custom-search tool=Search tool description"
    );
  });

  it("returns empty tool_names when no tools", async () => {
    setupDbChain([
      [],
      [],
      [],
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
// Tests — renderObjectField (from datasets/queries)
// ---------------------------------------------------------------------------

describe("renderObjectField", () => {
  it("renders LiquidJS expressions inside metadata JSON", async () => {
    const { renderObjectField } = await import("@/lib/datasets/queries");
    const result = renderObjectField(
      { label: "{{name}} Plan", count: 5 },
      { name: "Premium" }
    );
    expect(result).toEqual({ label: "Premium Plan", count: 5 });
  });

  it("returns original metadata when rendering fails", async () => {
    const { renderObjectField } = await import("@/lib/datasets/queries");
    const raw = { label: "{% invalid_tag %}" };
    const result = renderObjectField(raw, {});
    expect(result).toEqual(raw);
  });

  it("renders nested arrays and objects in metadata", async () => {
    const { renderObjectField } = await import("@/lib/datasets/queries");
    const result = renderObjectField(
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
