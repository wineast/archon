import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

const insertedValues: Record<string, unknown>[] = [];
const returningMock = vi.fn(() => [{ id: "run-1" }]);
const valuesMock = vi.fn((v: Record<string, unknown>) => {
  insertedValues.push(v);
  return { returning: returningMock };
});
const insertMock = vi.fn(() => ({ values: valuesMock }));

let selectResult: unknown[] = [
  { id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null },
];
const whereSelectMock = vi.fn(() => selectResult);
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

describe("POST /api/eval/run (create run)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    selectResult = [
      { id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null },
    ];
  });

  it("creates a run record and returns runId", async () => {
    const res = await POST(
      makeRequest({
        agentId: "agent-1",
        modelConfigId: "mc-1",
        judgeConfigId: "jc-1",
        judgeConfigName: "gpt-4-judge",
        filterTags: ["tag-a"],
        totalCases: 5,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ runId: "run-1" });
  });

  it("initializes passedAssertions=0 and averageScore=null", async () => {
    await POST(
      makeRequest({
        agentId: "agent-1",
        modelConfigId: "mc-1",
        judgeConfigName: "gpt-4-judge",
        totalCases: 3,
      })
    );

    expect(insertedValues[0]).toMatchObject({
      passedAssertions: 0,
      averageScore: null,
      totalCases: 3,
    });
  });

  it("returns 400 if model config not found", async () => {
    selectResult = [];
    const res = await POST(
      makeRequest({
        agentId: "agent-1",
        modelConfigId: "nonexistent",
        judgeConfigName: "judge",
        totalCases: 1,
      })
    );

    expect(res.status).toBe(400);
  });

  it("stores chatModel and chatSystemPrompt from model config", async () => {
    await POST(
      makeRequest({
        agentId: "agent-1",
        modelConfigId: "mc-1",
        judgeConfigName: "gpt-4-judge",
        totalCases: 2,
      })
    );

    expect(insertedValues[0]).toMatchObject({
      chatModel: "gpt-4",
      chatSystemPrompt: "You are helpful",
    });
  });

  it("defaults filterTags to empty array when not provided", async () => {
    await POST(
      makeRequest({
        agentId: "agent-1",
        modelConfigId: "mc-1",
        judgeConfigName: "judge",
        totalCases: 1,
      })
    );

    expect(insertedValues[0]).toMatchObject({
      filterTags: [],
    });
  });

  it("stores assertionFailConfig when provided", async () => {
    await POST(
      makeRequest({
        agentId: "agent-1",
        modelConfigId: "mc-1",
        judgeConfigName: "judge",
        totalCases: 1,
        assertionFailConfig: { judgeOnFail: true, stopOnTurnFail: true },
      })
    );

    expect(insertedValues[0]).toMatchObject({
      assertionFailConfig: { judgeOnFail: true, stopOnTurnFail: true },
    });
  });

  it("defaults assertionFailConfig to null when not provided", async () => {
    await POST(
      makeRequest({
        agentId: "agent-1",
        modelConfigId: "mc-1",
        judgeConfigName: "judge",
        totalCases: 1,
      })
    );

    expect(insertedValues[0]).toMatchObject({
      assertionFailConfig: null,
    });
  });
});
