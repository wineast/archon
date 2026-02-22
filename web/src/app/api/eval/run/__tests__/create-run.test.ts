import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

const insertedValues: Record<string, unknown>[] = [];
const returningMock = vi.fn(() => [{ id: "run-1" }]);
const valuesMock = vi.fn((v: Record<string, unknown>) => {
  insertedValues.push(v);
  return { returning: returningMock };
});
const insertMock = vi.fn(() => ({ values: valuesMock }));

// Track sequential select calls: modelConfig, judgeModelConfig, judgeConfig
let selectCallIndex = 0;
const selectResults: unknown[][] = [
  [{ id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null }],
  [{ id: "jmc-1", modelId: "gpt-4-judge", systemPrompt: "Judge this", temperature: 0.1, agentId: null }],
  [{ id: "jc-1", name: "Default", dimensions: [{ key: "quality", label: "Quality", weight: 1 }] }],
];
const whereSelectMock = vi.fn(() => selectResults[selectCallIndex++]);
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    insert: () => insertMock(),
    select: () => selectMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id" },
  modelConfigs: { id: "id" },
  judgeConfigs: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNull: (col: unknown) => ({ op: "isNull", col }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ agentId: "agent-1" }),
}));

const { POST } = await import("../route");

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/eval/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  agentId: "agent-1",
  modelConfigId: "mc-1",
  judgeAgentId: "judge-agent-1",
  judgeModelConfigId: "jmc-1",
  judgeConfigId: "jc-1",
  totalCases: 5,
};

describe("POST /api/eval/run (create run)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    selectCallIndex = 0;
    selectResults[0] = [{ id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null }];
    selectResults[1] = [{ id: "jmc-1", modelId: "gpt-4-judge", systemPrompt: "Judge this", temperature: 0.1, agentId: null }];
    selectResults[2] = [{ id: "jc-1", name: "Default", dimensions: [{ key: "quality", label: "Quality", weight: 1 }] }];
  });

  it("creates a run record and returns runId", async () => {
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ runId: "run-1" });
  });

  it("initializes passedAssertions=0 and averageScore=null", async () => {
    await POST(makeRequest({ ...baseBody, totalCases: 3 }));

    expect(insertedValues[0]).toMatchObject({
      passedAssertions: 0,
      averageScore: null,
      totalCases: 3,
    });
  });

  it("returns 400 if model config not found", async () => {
    selectResults[0] = [];
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(400);
  });

  it("returns 400 if judge model config not found", async () => {
    selectResults[1] = [];
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(400);
  });

  it("returns 400 if judge config not found", async () => {
    selectResults[2] = [];
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(400);
  });

  it("stores chatModel and chatSystemPrompt from model config", async () => {
    await POST(makeRequest(baseBody));

    expect(insertedValues[0]).toMatchObject({
      chatModel: "gpt-4",
      chatSystemPrompt: "You are helpful",
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
