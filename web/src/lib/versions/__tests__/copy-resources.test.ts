import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted helper ──
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
vi.mock("@/db/schema", () => ({
  datasets: mkTable("datasets"),
  schemas: mkTable("schemas"),
  schemaTestCases: mkTable("schemaTestCases", ["schemaId"]),
  objectTypes: mkTable("objectTypes"),
  objectRelations: mkTable("objectRelations", ["sourceTypeId", "targetTypeId"]),
  components: mkTable("components"),
  componentTestCases: mkTable("componentTestCases", ["componentId"]),
  tools: mkTable("tools", ["componentId"]),
  toolTestCases: mkTable("toolTestCases", ["toolId"]),
  functions: mkTable("functions"),
  functionTestCases: mkTable("functionTestCases", ["functionId"]),
  wikiDocuments: mkTable("wikiDocuments"),
  modelConfigs: mkTable("modelConfigs"),
  chatConfigs: mkTable("chatConfigs"),
  evalCases: mkTable("evalCases"),
  judgeConfigs: mkTable("judgeConfigs"),
  mcpServers: mkTable("mcpServers"),
  skills: mkTable("skills"),
  memoryConfigs: mkTable("memoryConfigs"),
  agentResourceRefs: mkTable("agentResourceRefs"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ _op: "eq", col, val })),
  and: vi.fn((...conds: unknown[]) => ({ _op: "and", conds })),
  isNull: vi.fn((col: unknown) => ({ _op: "isNull", col })),
  inArray: vi.fn((col: unknown, vals: unknown[]) => ({ _op: "inArray", col, vals })),
}));

const { copyVersionResources } = await import("../copy-resources");

// ── Mock TX factory ──
function createMockTx() {
  const selectCalls: { table: string }[] = [];
  const insertCalls: { table: string; data: unknown }[] = [];
  const updateCalls: { table: string; data: unknown }[] = [];

  // Configure select responses by table name (returns first match, then removes it)
  const selectQueues = new Map<string, unknown[][]>();
  function addSelectResponse(tableName: string, data: unknown[]) {
    const queue = selectQueues.get(tableName) ?? [];
    queue.push(data);
    selectQueues.set(tableName, queue);
  }

  // Configure insert returning results by table name
  const insertReturns = new Map<string, unknown[]>();

  const tx = {
    select: () => ({
      from: (table: { _name: string }) => {
        const tableName = table._name;
        return {
          where: () => {
            selectCalls.push({ table: tableName });
            const queue = selectQueues.get(tableName) ?? [];
            return queue.shift() ?? [];
          },
        };
      },
    }),
    insert: (table: { _name: string }) => ({
      values: (data: unknown) => {
        insertCalls.push({ table: table._name, data });
        return {
          returning: () => insertReturns.get(table._name) ?? [],
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
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: tx as any,
    selectCalls,
    insertCalls,
    updateCalls,
    addSelectResponse,
    insertReturns,
  };
}

// ── Test data factory ──
function makeDatasetRow(id: string, key: string) {
  return { id, key, name: key, description: "", data: {}, versionId: "src-v", deletedAt: null, agentId: "a1", origin: "user" };
}

function makeSchemaRow(id: string, key: string) {
  return { id, key, name: key, description: "", parameters: {}, versionId: "src-v", deletedAt: null, agentId: "a1", origin: "user" };
}

function makeObjTypeRow(id: string, key: string, schemaId: string | null = null) {
  return { id, key, name: key, description: "", icon: "📦", color: "blue", schemaId, titleProperty: null, source: "internal", externalConfig: null, order: 0, versionId: "src-v", deletedAt: null, agentId: "a1" };
}

function makeObjRelRow(id: string, key: string, sourceTypeId: string, targetTypeId: string) {
  return { id, key, name: key, description: "", sourceTypeId, targetTypeId, relationType: "has_many", inverseName: "", order: 0, versionId: "src-v", deletedAt: null, agentId: "a1" };
}

function makeCompRow(id: string, key: string) {
  return { id, key, name: key, description: "", componentSource: "", generatedCss: "", toolInputSchema: null, componentInputSchema: null, versionId: "src-v", deletedAt: null, agentId: "a1", origin: "user" };
}

function makeToolRow(id: string, key: string, componentId: string | null = null) {
  return { id, key, name: key, description: "", parametersSchema: null, returnParametersSchema: null, handler: "", url: null, componentId, enabled: true, executionTarget: "server", sandboxMode: "off", versionId: "src-v", deletedAt: null, agentId: "a1", origin: "user" };
}

function makeFuncRow(id: string, key: string) {
  return { id, key, name: key, description: "", code: "", parametersSchema: null, returnParametersSchema: null, versionId: "src-v", deletedAt: null, agentId: "a1", origin: "user" };
}

function makeWikiRow(id: string, key: string, parentId: string | null = null) {
  return { id, key, name: key, content: "", order: 0, parentId, versionId: "src-v", deletedAt: null, agentId: "a1", origin: "user" };
}

/* ═══════════════════════════════════════════════ */

describe("copyVersionResources", () => {
  it("copies datasets with new versionId and builds idMap", async () => {
    const mock = createMockTx();
    mock.addSelectResponse("datasets", [makeDatasetRow("old-d1", "ds-key")]);
    mock.insertReturns.set("datasets", [{ id: "new-d1", key: "ds-key" }]);
    // All other selects return empty
    for (let i = 0; i < 15; i++) {
      mock.addSelectResponse(["schemas", "objectTypes", "objectRelations", "components", "tools", "functions", "wikiDocuments", "modelConfigs", "chatConfigs", "evalCases", "judgeConfigs", "mcpServers", "skills", "memoryConfigs", "agentResourceRefs"][i], []);
    }

    await copyVersionResources("a1", "src-v", "tgt-v", mock.tx);

    const dsInsert = mock.insertCalls.find((c) => c.table === "datasets");
    expect(dsInsert).toBeDefined();
    const inserted = (dsInsert!.data as { versionId: string; key: string }[])[0];
    expect(inserted.versionId).toBe("tgt-v");
    expect(inserted.key).toBe("ds-key");
  });

  it("filters objectRelations when source or target type missing", async () => {
    const mock = createMockTx();

    // Empty for datasets, schemas
    mock.addSelectResponse("datasets", []);
    mock.addSelectResponse("schemas", []);
    // objectTypes: only ot-1 exists, ot-deleted is missing
    mock.addSelectResponse("objectTypes", [makeObjTypeRow("ot-1", "type-a")]);
    mock.insertReturns.set("objectTypes", [{ id: "new-ot-1", key: "type-a" }]);
    // objectRelations: one valid (both types exist), one invalid (target missing)
    mock.addSelectResponse("objectRelations", [
      makeObjRelRow("or-1", "rel-valid", "ot-1", "ot-1"),
      makeObjRelRow("or-2", "rel-invalid", "ot-1", "ot-deleted"),
    ]);
    // Remaining tables: empty
    for (const t of ["components", "tools", "functions", "wikiDocuments", "modelConfigs", "chatConfigs", "evalCases", "judgeConfigs", "mcpServers", "skills", "memoryConfigs", "agentResourceRefs"]) {
      mock.addSelectResponse(t, []);
    }

    await copyVersionResources("a1", "src-v", "tgt-v", mock.tx);

    const orInsert = mock.insertCalls.find((c) => c.table === "objectRelations");
    expect(orInsert).toBeDefined();
    const relations = orInsert!.data as { key: string }[];
    expect(relations).toHaveLength(1);
    expect(relations[0].key).toBe("rel-valid");
  });

  it("falls back to original componentId when not in compIdMap (pool resource)", async () => {
    const mock = createMockTx();

    for (const t of ["datasets", "schemas", "objectTypes", "objectRelations"]) {
      mock.addSelectResponse(t, []);
    }
    // components: empty (no local components)
    mock.addSelectResponse("components", []);
    // tools: one tool referencing a pool component
    mock.addSelectResponse("tools", [makeToolRow("t1", "my-tool", "pool-comp-id")]);
    mock.insertReturns.set("tools", [{ id: "new-t1", key: "my-tool" }]);
    // toolTestCases: empty
    mock.addSelectResponse("toolTestCases", []);
    // Remaining
    for (const t of ["functions", "wikiDocuments", "modelConfigs", "chatConfigs", "evalCases", "judgeConfigs", "mcpServers", "skills", "memoryConfigs", "agentResourceRefs"]) {
      mock.addSelectResponse(t, []);
    }

    await copyVersionResources("a1", "src-v", "tgt-v", mock.tx);

    const toolInsert = mock.insertCalls.find((c) => c.table === "tools");
    const toolData = (toolInsert!.data as { componentId: string | null }[])[0];
    // Falls back to original componentId since it's not in compIdMap
    expect(toolData.componentId).toBe("pool-comp-id");
  });

  it("filters test cases when parent resource deleted", async () => {
    const mock = createMockTx();

    for (const t of ["datasets", "schemas", "objectTypes", "objectRelations", "components"]) {
      mock.addSelectResponse(t, []);
    }
    // tools: one tool
    mock.addSelectResponse("tools", [makeToolRow("t1", "my-tool")]);
    mock.insertReturns.set("tools", [{ id: "new-t1", key: "my-tool" }]);
    // toolTestCases: one belongs to t1, one to deleted tool
    mock.addSelectResponse("toolTestCases", [
      { id: "tc1", toolId: "t1", name: "TC1", input: {}, expectedOutput: "", tags: [], showAsExample: false },
      { id: "tc2", toolId: "deleted-tool", name: "TC2", input: {}, expectedOutput: "", tags: [], showAsExample: false },
    ]);
    // Remaining
    for (const t of ["functions", "wikiDocuments", "modelConfigs", "chatConfigs", "evalCases", "judgeConfigs", "mcpServers", "skills", "memoryConfigs", "agentResourceRefs"]) {
      mock.addSelectResponse(t, []);
    }

    await copyVersionResources("a1", "src-v", "tgt-v", mock.tx);

    const tcInsert = mock.insertCalls.find((c) => c.table === "toolTestCases");
    expect(tcInsert).toBeDefined();
    const tcs = tcInsert!.data as { name: string }[];
    expect(tcs).toHaveLength(1);
    expect(tcs[0].name).toBe("TC1");
  });

  it("copies resource refs with same resourceId but new versionId", async () => {
    const mock = createMockTx();

    for (const t of ["datasets", "schemas", "objectTypes", "objectRelations", "components", "tools", "functions", "wikiDocuments", "modelConfigs", "chatConfigs", "evalCases", "judgeConfigs", "mcpServers", "skills", "memoryConfigs"]) {
      mock.addSelectResponse(t, []);
    }
    // agentResourceRefs: one pool ref
    mock.addSelectResponse("agentResourceRefs", [
      { id: "ref-1", agentId: "a1", versionId: "src-v", resourceType: "tool", resourceId: "pool-tool-1", enabled: true },
    ]);

    await copyVersionResources("a1", "src-v", "tgt-v", mock.tx);

    const refInsert = mock.insertCalls.find((c) => c.table === "agentResourceRefs");
    expect(refInsert).toBeDefined();
    const refData = (refInsert!.data as { resourceId: string; versionId: string }[])[0];
    expect(refData.resourceId).toBe("pool-tool-1"); // unchanged
    expect(refData.versionId).toBe("tgt-v"); // updated
  });

  it("handles wiki two-pass parentId update", async () => {
    const mock = createMockTx();

    for (const t of ["datasets", "schemas", "objectTypes", "objectRelations", "components", "tools", "functions"]) {
      mock.addSelectResponse(t, []);
    }
    // wiki: parent + child
    mock.addSelectResponse("wikiDocuments", [
      makeWikiRow("w1", "root", null),
      makeWikiRow("w2", "child", "w1"),
    ]);
    mock.insertReturns.set("wikiDocuments", [
      { id: "new-w1", key: "root" },
      { id: "new-w2", key: "child" },
    ]);
    for (const t of ["modelConfigs", "chatConfigs", "evalCases", "judgeConfigs", "mcpServers", "skills", "memoryConfigs", "agentResourceRefs"]) {
      mock.addSelectResponse(t, []);
    }

    await copyVersionResources("a1", "src-v", "tgt-v", mock.tx);

    // First pass: insert with null parentId
    const wikiInsert = mock.insertCalls.find((c) => c.table === "wikiDocuments");
    const docs = wikiInsert!.data as { parentId: string | null }[];
    expect(docs.every((d) => d.parentId === null)).toBe(true);

    // Second pass: update child's parentId
    const wikiUpdates = mock.updateCalls.filter((c) => c.table === "wikiDocuments");
    expect(wikiUpdates).toHaveLength(1);
    expect(wikiUpdates[0].data).toEqual({ parentId: "new-w1" });
  });
});
