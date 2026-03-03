import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

const insertedValues: Record<string, unknown>[] = [];
const returningMock = vi.fn(() => [{ id: "run-1", chatModel: "gpt-4", status: "running" }]);
const valuesMock = vi.fn((v: Record<string, unknown>) => {
  insertedValues.push(v);
  return { returning: returningMock };
});
const insertMock = vi.fn(() => ({ values: valuesMock }));

// Track sequential select calls: concurrency check, modelConfig, judgeModelConfig, judgeConfig
let selectCallIndex = 0;
const selectResults: unknown[][] = [
  // concurrency check: no running runs
  [],
  // modelConfig
  [{ id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null }],
  // judgeModelConfig
  [{ id: "jmc-1", modelId: "gpt-4-judge", systemPrompt: "Judge this", temperature: 0.1, agentId: null }],
  // judgeConfig
  [{ id: "jc-1", name: "Default", dimensions: [{ key: "quality", label: "Quality", weight: 1 }], promptTemplate: "Custom prompt", turnPromptTemplate: null }],
];

const limitMock = vi.fn(() => selectResults[selectCallIndex++]);
const whereSelectMock = vi.fn(() => {
  const idx = selectCallIndex;
  // First call (concurrency check) has .limit()
  if (idx === 0) {
    return { limit: limitMock };
  }
  return selectResults[selectCallIndex++];
});
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => {
  const txProxy = {
    insert: () => insertMock(),
    select: () => selectMock(),
  };
  return {
    db: {
      insert: () => insertMock(),
      select: () => selectMock(),
      transaction: async (fn: (tx: typeof txProxy) => Promise<unknown>) => fn(txProxy),
    },
  };
});

vi.mock("@/db/schema", () => ({
  evalBatches: { id: "id", agentId: "agent_id", status: "status" },
  evalRuns: { id: "id", agentId: "agent_id", status: "status" },
  modelConfigs: { id: "id", versionId: "version_id", isActive: "is_active" },
  judgeConfigs: { id: "id", versionId: "version_id", isActive: "is_active" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNull: (col: unknown) => ({ op: "isNull", col }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ agentId: "agent-1", user: { id: "user-1" } }),
}));

vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockImplementation((agentId: string) =>
    Promise.resolve(agentId === "agent-1" ? "version-1" : "judge-version-1")
  ),
}));

// Mock inngest client
const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["evt-1"] });
vi.mock("@/inngest/client", () => ({
  inngest: { send: (...args: unknown[]) => inngestSendMock(...args) },
}));

const { POST } = await import("../route");

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/eval/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseCases = [{ id: "c1", key: "test", name: "Test", mode: "single", turns: [], assertions: [], expectedOutput: "" }];

const baseBody = {
  agentId: "agent-1",
  judgeAgentId: "judge-agent-1",
  totalCases: 1,
  cases: baseCases,
};

describe("POST /api/eval/run (create run)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    selectCallIndex = 0;
    selectResults[0] = []; // concurrency: no running
    selectResults[1] = [{ id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null }];
    selectResults[2] = [{ id: "jmc-1", modelId: "gpt-4-judge", systemPrompt: "Judge this", temperature: 0.1, agentId: null }];
    selectResults[3] = [{ id: "jc-1", name: "Default", dimensions: [{ key: "quality", label: "Quality", weight: 1 }], promptTemplate: "Custom prompt", turnPromptTemplate: null }];
  });

  it("creates a run record and returns runId + chatModel + status", async () => {
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ runId: "run-1", chatModel: "gpt-4", status: "running" });
  });

  it("creates run with status=running and completedCases=0", async () => {
    await POST(makeRequest(baseBody));

    expect(insertedValues[0]).toMatchObject({
      status: "running",
      completedCases: 0,
      passedAssertions: 0,
      averageScore: null,
    });
  });

  it("sends inngest event with runId and caseIds", async () => {
    await POST(makeRequest(baseBody));

    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "eval/run.created",
      data: {
        runId: "run-1",
        agentId: "agent-1",
        caseIds: ["c1"],
        userId: "user-1",
      },
    });
  });

  it("stores templateVars and toolNames in run record", async () => {
    await POST(
      makeRequest({
        ...baseBody,
        templateVars: { key1: "val1" },
        toolNames: ["tool1", "tool2"],
      })
    );

    expect(insertedValues[0]).toMatchObject({
      templateVars: { key1: "val1" },
      toolNames: ["tool1", "tool2"],
    });
  });

  it("returns 400 if cases are missing", async () => {
    const res = await POST(makeRequest({ ...baseBody, cases: [] }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("cases");
  });

  it("returns 409 if another run is already running", async () => {
    selectResults[0] = [{ id: "existing-run" }]; // concurrency: has running run

    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("already in progress");
  });

  it("returns 400 if no active model config found", async () => {
    selectResults[1] = [];
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("active model config");
  });

  it("returns 400 if no active judge model config found", async () => {
    selectResults[2] = [];
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("active model config");
  });

  it("returns 400 if no active judge config found", async () => {
    selectResults[3] = [];
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("active judge config");
  });

  it("stores chatModel, chatSystemPrompt, and chatTemperature from model config", async () => {
    await POST(makeRequest(baseBody));

    expect(insertedValues[0]).toMatchObject({
      chatModel: "gpt-4",
      chatSystemPrompt: "You are helpful",
      chatTemperature: 0.7,
    });
  });

  it("stores judgeAgentId and snapshots", async () => {
    await POST(makeRequest(baseBody));

    expect(insertedValues[0]).toMatchObject({
      judgeAgentId: "judge-agent-1",
      judgeModelConfigSnapshot: {
        modelId: "gpt-4-judge",
        systemPrompt: "Judge this",
        temperature: 0.1,
      },
      judgeConfigSnapshot: {
        name: "Default",
        dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
        promptTemplate: "Custom prompt",
        turnPromptTemplate: null,
      },
    });
  });

  it("defaults filterTags to empty array when not provided", async () => {
    await POST(makeRequest(baseBody));

    expect(insertedValues[0]).toMatchObject({
      filterTags: [],
    });
  });

  it("stores assertionFailConfig when provided", async () => {
    await POST(
      makeRequest({
        ...baseBody,
        assertionFailConfig: { judgeOnFail: true, stopOnTurnFail: true },
      })
    );

    expect(insertedValues[0]).toMatchObject({
      assertionFailConfig: { judgeOnFail: true, stopOnTurnFail: true },
    });
  });

  it("defaults assertionFailConfig to null when not provided", async () => {
    await POST(makeRequest(baseBody));

    expect(insertedValues[0]).toMatchObject({
      assertionFailConfig: null,
    });
  });
});
