import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentSnapshot } from "../types";

// ── Hoisted helper for table markers ──
const mkTable = vi.hoisted(() => {
  return (name: string, extra: string[] = []) => {
    const t: Record<string, string> = { _name: name };
    for (const c of ["id", "key", "versionId", "deletedAt", "agentId", ...extra]) {
      t[c] = `${name}.${c}`;
    }
    return t;
  };
});

// ── Module mocks ──
vi.mock("@/db", () => ({ db: {} }));

vi.mock("@/db/schema", () => ({
  agents: mkTable("agents"),
  tools: mkTable("tools"),
  functions: mkTable("functions"),
  components: mkTable("components"),
  schemas: mkTable("schemas"),
  wikiDocuments: mkTable("wikiDocuments", ["parentId"]),
  datasets: mkTable("datasets"),
  modelConfigs: mkTable("modelConfigs"),
  chatConfigs: mkTable("chatConfigs"),
  memoryConfigs: mkTable("memoryConfigs"),
  evalCases: mkTable("evalCases"),
  judgeConfigs: mkTable("judgeConfigs"),
  toolTestCases: mkTable("toolTestCases", ["toolId"]),
  functionTestCases: mkTable("functionTestCases", ["functionId"]),
  componentTestCases: mkTable("componentTestCases", ["componentId"]),
  objectTypes: mkTable("objectTypes"),
  objectRelations: mkTable("objectRelations"),
  mcpServers: mkTable("mcpServers"),
  skills: mkTable("skills"),
  agentResourceRefs: mkTable("agentResourceRefs"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ _op: "eq", col, val })),
  and: vi.fn((...conds: unknown[]) => ({ _op: "and", conds })),
  isNull: vi.fn((col: unknown) => ({ _op: "isNull", col })),
  inArray: vi.fn((col: unknown, vals: unknown[]) => ({ _op: "inArray", col, vals })),
}));

vi.mock("@/lib/pool/constants", () => ({
  RESOURCE_TABLE_MAP: {
    tool: mkTable("tools"),
    component: mkTable("components"),
    function: mkTable("functions"),
    dataset: mkTable("datasets"),
    wiki: mkTable("wikiDocuments"),
    schema: mkTable("schemas"),
    "mcp-server": mkTable("mcpServers"),
  },
}));

const { buildSnapshot, restoreSnapshot } = await import("../snapshot");

// ── Mock DB factory for buildSnapshot (sequential index for Promise.all) ──
function createMockDb(responses: unknown[][]) {
  let idx = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => {
          const data = responses[idx++] ?? [];
          return Object.assign([...data], { limit: () => data });
        },
        innerJoin: () => ({
          where: () => responses[idx++] ?? [],
        }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ── Mock TX factory for restoreSnapshot ──
function createMockTx() {
  const deleteCalls: string[] = [];
  const insertCalls: { table: string; data: unknown }[] = [];
  const updateCalls: { table: string; data: unknown }[] = [];
  const insertReturns = new Map<string, unknown[]>();
  let selectIdx = 0;
  const selectResults: unknown[][] = [];

  const tx = {
    delete: (table: { _name: string }) => ({
      where: () => {
        deleteCalls.push(table._name);
      },
    }),
    insert: (table: { _name: string }) => ({
      values: (data: unknown) => {
        insertCalls.push({ table: table._name, data });
        return {
          returning: () => insertReturns.get(table._name) ?? [],
          onConflictDoNothing: () => {},
        };
      },
    }),
    update: (table: { _name: string }) => ({
      set: (data: unknown) => ({
        where: () => {
          updateCalls.push({ table: table._name, data });
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => {
          const data = selectResults[selectIdx++] ?? [];
          return Object.assign([...data], { limit: () => data });
        },
      }),
    }),
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: tx as any,
    deleteCalls,
    insertCalls,
    updateCalls,
    insertReturns,
    selectResults,
  };
}

// ── Minimal snapshot factory ──
function makeSnapshot(overrides: Partial<AgentSnapshot> = {}): AgentSnapshot {
  return {
    agent: { name: "A", description: "", icon: "", slug: "a", isPublic: false },
    tools: [],
    functions: [],
    components: [],
    schemas: [],
    wikiDocuments: [],
    datasets: [],
    modelConfigs: [],
    chatConfig: null,
    memoryConfig: null,
    evalCases: [],
    judgeConfigs: [],
    objectTypes: [],
    objectRelations: [],
    mcpServers: [],
    skills: [],
    resourceRefs: [],
    ...overrides,
  };
}

const agentRow = {
  id: "agent-1",
  name: "Test",
  description: "d",
  icon: "🤖",
  slug: "test",
  isPublic: false,
};

// 20 empty arrays for buildSnapshot's Promise.all (agents + 19 resource queries)
const emptyResponses = () => Array(20).fill([]);

/* ═══════════════════════════════════════════════
   buildSnapshot
   ═══════════════════════════════════════════════ */

describe("buildSnapshot", () => {
  it("throws when agent not found", async () => {
    const db = createMockDb(emptyResponses());
    await expect(buildSnapshot("missing", "v1", db)).rejects.toThrow("Agent not found");
  });

  it("returns correct snapshot structure for populated agent", async () => {
    const responses = emptyResponses();
    responses[0] = [agentRow];
    responses[1] = [{ id: "t1", key: "my-tool", name: "Tool", description: "d", parametersSchema: null, returnParametersSchema: null, handler: "code", url: null, componentId: null, enabled: true, uiHidden: false, executionTarget: "server" }];
    responses[2] = [{ id: "f1", key: "my-func", name: "Func", description: "d", code: "x", parametersSchema: null, returnParametersSchema: null }];
    responses[4] = [{ id: "s1", key: "my-schema", name: "Schema", description: "d", parameters: {} }];
    responses[6] = [{ id: "d1", key: "my-ds", name: "DS", description: "d", data: { rows: [] } }];

    const snap = await buildSnapshot("agent-1", "v1", createMockDb(responses));

    expect(snap.agent).toEqual({ name: "Test", description: "d", icon: "🤖", slug: "test", isPublic: false });
    expect(snap.tools).toHaveLength(1);
    expect(snap.tools[0].key).toBe("my-tool");
    expect(snap.tools[0].testCases).toEqual([]);
    expect(snap.functions).toHaveLength(1);
    expect(snap.schemas).toHaveLength(1);
    expect(snap.datasets).toHaveLength(1);
  });

  it("maps tool componentKey via compIdToKey", async () => {
    const responses = emptyResponses();
    responses[0] = [agentRow];
    responses[1] = [{ id: "t1", key: "my-tool", name: "T", description: "", parametersSchema: null, returnParametersSchema: null, handler: null, url: null, componentId: "comp-1", enabled: true, uiHidden: false, executionTarget: "server" }];
    responses[3] = [{ id: "comp-1", key: "my-comp", name: "C", description: "", componentSource: "", generatedCss: "", toolInputSchema: null, componentInputSchema: null }];

    const snap = await buildSnapshot("agent-1", "v1", createMockDb(responses));
    expect(snap.tools[0].componentKey).toBe("my-comp");
  });

  it("sets componentKey to null when component not found", async () => {
    const responses = emptyResponses();
    responses[0] = [agentRow];
    responses[1] = [{ id: "t1", key: "my-tool", name: "T", description: "", parametersSchema: null, returnParametersSchema: null, handler: null, url: null, componentId: "missing", enabled: true, uiHidden: false, executionTarget: "server" }];

    const snap = await buildSnapshot("agent-1", "v1", createMockDb(responses));
    expect(snap.tools[0].componentKey).toBeNull();
  });

  it("maps wiki parentKey via wikiIdToKey", async () => {
    const responses = emptyResponses();
    responses[0] = [agentRow];
    responses[5] = [
      { id: "w1", key: "root", name: "Root", content: "", order: 0, parentId: null },
      { id: "w2", key: "child", name: "Child", content: "", order: 1, parentId: "w1" },
    ];

    const snap = await buildSnapshot("agent-1", "v1", createMockDb(responses));
    expect(snap.wikiDocuments[0].parentKey).toBeNull();
    expect(snap.wikiDocuments[1].parentKey).toBe("root");
  });

  it("groups test cases by parent tool key", async () => {
    const responses = emptyResponses();
    responses[0] = [agentRow];
    responses[1] = [
      { id: "t1", key: "tool-a", name: "A", description: "", parametersSchema: null, returnParametersSchema: null, handler: "", url: null, componentId: null, enabled: true, uiHidden: false, executionTarget: "server" },
      { id: "t2", key: "tool-b", name: "B", description: "", parametersSchema: null, returnParametersSchema: null, handler: "", url: null, componentId: null, enabled: true, uiHidden: false, executionTarget: "server" },
    ];
    // toolTestCases (innerJoin result at index 12)
    responses[12] = [
      { tools: { id: "t1" }, tool_test_cases: { name: "TC1", input: {}, expectedOutput: "x", tags: [], assertions: [] } },
      { tools: { id: "t1" }, tool_test_cases: { name: "TC2", input: {}, expectedOutput: "y", tags: [], assertions: [] } },
      { tools: { id: "t2" }, tool_test_cases: { name: "TC3", input: {}, expectedOutput: "z", tags: [], assertions: [] } },
    ];

    const snap = await buildSnapshot("agent-1", "v1", createMockDb(responses));
    expect(snap.tools[0].testCases).toHaveLength(2);
    expect(snap.tools[0].testCases[0].name).toBe("TC1");
    expect(snap.tools[1].testCases).toHaveLength(1);
    expect(snap.tools[1].testCases[0].name).toBe("TC3");
  });

  it("resolves resource refs and skips missing pool resources", async () => {
    const responses = emptyResponses();
    responses[0] = [agentRow];
    // agentResourceRefs (index 19): 2 refs, one resolvable
    responses[19] = [
      { resourceType: "tool", resourceId: "pool-t1", enabled: true },
      { resourceType: "tool", resourceId: "pool-t2", enabled: false },
    ];
    // Post-Promise.all pool query: only pool-t1 found
    responses[20] = [{ id: "pool-t1", key: "builtin-tool" }];

    const snap = await buildSnapshot("agent-1", "v1", createMockDb(responses));
    expect(snap.resourceRefs).toHaveLength(1);
    expect(snap.resourceRefs[0]).toEqual({
      resourceType: "tool",
      resourceKey: "builtin-tool",
      enabled: true,
    });
  });

  it("maps objectType schemaKey via schemaIdToKey", async () => {
    const responses = emptyResponses();
    responses[0] = [agentRow];
    responses[4] = [{ id: "s1", key: "person-schema", name: "Person", description: "", parameters: {} }];
    responses[15] = [{ id: "ot1", key: "person", name: "Person", description: "", icon: "👤", color: "blue", schemaId: "s1", titleProperty: "name", source: "internal", externalConfig: null, order: 0 }];

    const snap = await buildSnapshot("agent-1", "v1", createMockDb(responses));
    expect(snap.objectTypes[0].schemaKey).toBe("person-schema");
  });
});

/* ═══════════════════════════════════════════════
   restoreSnapshot
   ═══════════════════════════════════════════════ */

describe("restoreSnapshot", () => {
  it("deletes objectRelations before other tables", async () => {
    const mock = createMockTx();
    await restoreSnapshot("a1", "v1", makeSnapshot(), mock.tx);

    expect(mock.deleteCalls[0]).toBe("objectRelations");
    expect(mock.deleteCalls.length).toBeGreaterThan(1);
    expect(mock.deleteCalls.filter((d) => d === "objectRelations")).toHaveLength(1);
  });

  it("inserts wiki docs with null parentId then updates parentId", async () => {
    const mock = createMockTx();
    mock.insertReturns.set("wikiDocuments", [
      { id: "new-w1", key: "root" },
      { id: "new-w2", key: "child" },
    ]);

    await restoreSnapshot(
      "a1",
      "v1",
      makeSnapshot({
        wikiDocuments: [
          { key: "root", name: "Root", content: "", order: 0, parentKey: null },
          { key: "child", name: "Child", content: "", order: 1, parentKey: "root" },
        ],
      }),
      mock.tx
    );

    const wikiInsert = mock.insertCalls.find((c) => c.table === "wikiDocuments");
    expect(wikiInsert).toBeDefined();
    const docs = wikiInsert!.data as { parentId: string | null }[];
    expect(docs.every((d) => d.parentId === null)).toBe(true);

    const wikiUpdates = mock.updateCalls.filter((c) => c.table === "wikiDocuments");
    expect(wikiUpdates).toHaveLength(1);
    expect(wikiUpdates[0].data).toEqual({ parentId: "new-w1" });
  });

  it("resolves pool components for unresolved componentKeys", async () => {
    const mock = createMockTx();
    mock.insertReturns.set("tools", [{ id: "new-t1", key: "my-tool" }]);
    // Pool component query result
    mock.selectResults.push([{ id: "pool-comp-id", key: "pool-comp" }]);

    await restoreSnapshot(
      "a1",
      "v1",
      makeSnapshot({
        tools: [
          {
            key: "my-tool", name: "T", description: "", parametersSchema: null,
            returnParametersSchema: null, handler: null, url: null,
            componentKey: "pool-comp", enabled: true, uiHidden: false,
            executionTarget: "server", testCases: [],
          },
        ],
      }),
      mock.tx
    );

    const toolInsert = mock.insertCalls.find((c) => c.table === "tools");
    const toolData = (toolInsert!.data as { componentId: string | null }[])[0];
    expect(toolData.componentId).toBe("pool-comp-id");
  });

  it("maps schemaKey to new schemaId in objectTypes", async () => {
    const mock = createMockTx();
    mock.insertReturns.set("schemas", [{ id: "new-s1", key: "person-schema" }]);
    mock.insertReturns.set("objectTypes", [{ id: "new-ot1", key: "person" }]);

    await restoreSnapshot(
      "a1",
      "v1",
      makeSnapshot({
        schemas: [{ key: "person-schema", name: "Person", description: "", parameters: {} }],
        objectTypes: [
          {
            key: "person", name: "Person", description: "", icon: "👤", color: "blue",
            schemaKey: "person-schema", titleProperty: "name",
            source: "internal", externalConfig: null, order: 0,
          },
        ],
      }),
      mock.tx
    );

    const otInsert = mock.insertCalls.find((c) => c.table === "objectTypes");
    const otData = (otInsert!.data as { schemaId: string | null }[])[0];
    expect(otData.schemaId).toBe("new-s1");
  });

  it("restores resource refs via pool lookup", async () => {
    const mock = createMockTx();
    mock.selectResults.push([{ id: "pool-res-1" }]);

    await restoreSnapshot(
      "a1",
      "v1",
      makeSnapshot({
        resourceRefs: [{ resourceType: "tool" as "tool", resourceKey: "builtin-tool", enabled: true }],
      }),
      mock.tx
    );

    const refInsert = mock.insertCalls.find((c) => c.table === "agentResourceRefs");
    expect(refInsert).toBeDefined();
    const refData = refInsert!.data as { resourceId: string; enabled: boolean };
    expect(refData.resourceId).toBe("pool-res-1");
    expect(refData.enabled).toBe(true);
  });

  it("skips resource ref when pool resource not found", async () => {
    const mock = createMockTx();
    mock.selectResults.push([]); // pool lookup returns empty

    await restoreSnapshot(
      "a1",
      "v1",
      makeSnapshot({
        resourceRefs: [{ resourceType: "tool" as "tool", resourceKey: "missing", enabled: true }],
      }),
      mock.tx
    );

    const refInserts = mock.insertCalls.filter((c) => c.table === "agentResourceRefs");
    expect(refInserts).toHaveLength(0);
  });

  it("handles empty snapshot without insert calls", async () => {
    const mock = createMockTx();
    await restoreSnapshot("a1", "v1", makeSnapshot(), mock.tx);

    expect(mock.deleteCalls.length).toBeGreaterThan(0);
    expect(mock.insertCalls).toHaveLength(0);
    expect(mock.updateCalls).toHaveLength(0);
  });
});
