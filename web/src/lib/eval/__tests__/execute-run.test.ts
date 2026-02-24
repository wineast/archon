import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

let runStatus = "running";
let updatedFields: Record<string, unknown>[] = [];
let insertedResults: Record<string, unknown>[] = [];

const whereUpdateMock = vi.fn();
const setMock = vi.fn((v: Record<string, unknown>) => {
  updatedFields.push(v);
  return { where: whereUpdateMock };
});
const updateMock = vi.fn(() => ({ set: setMock }));

const valuesMock = vi.fn((v: Record<string, unknown>) => {
  insertedResults.push(v);
});
const insertMock = vi.fn(() => ({ values: valuesMock }));

let selectCallIndex = 0;
const selectResults: (() => unknown[])[] = [];

const whereSelectMock = vi.fn(() => {
  const idx = selectCallIndex++;
  return selectResults[idx] ? selectResults[idx]() : [];
});
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
    insert: () => insertMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id", status: "status", completedCases: "completed_cases" },
  evalRunResults: { runId: "run_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

const mockExecuteCase = vi.fn();
vi.mock("../execute-case", () => ({
  executeCase: (...args: unknown[]) => mockExecuteCase(...args),
}));

vi.mock("@/lib/usage/record", () => ({
  recordUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/get-org-id", () => ({
  getOrgIdByAgentId: vi.fn().mockResolvedValue("org-1"),
}));

const { executeEvalRun } = await import("../execute-run");

const baseRun = {
  id: "run-1",
  agentId: "agent-1",
  chatModel: "gpt-4",
  chatSystemPrompt: "You are helpful",
  chatTemperature: 0.7,
  judgeModelConfigSnapshot: { modelId: "gpt-4-judge" },
  judgeConfigSnapshot: null,
  assertionFailConfig: null,
  status: "running",
};

const baseCases = [
  { id: "c1", key: "test1", name: "Case 1", mode: "single" as const, turns: [], assertions: [], expectedOutput: "" },
  { id: "c2", key: "test2", name: "Case 2", mode: "single" as const, turns: [], assertions: [], expectedOutput: "" },
];

describe("executeEvalRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatedFields = [];
    insertedResults = [];
    selectCallIndex = 0;
    selectResults.length = 0;
    runStatus = "running";
  });

  it("executes all cases and finalizes run", async () => {
    // select[0]: run record, select[1..2]: cancel checks, select[3]: finalize status, select[4]: finalize results
    selectResults.push(
      () => [baseRun], // load run
      () => [{ status: "running" }], // cancel check for case 1
      () => [{ status: "running" }], // cancel check for case 2
      () => [{ status: "running" }], // finalize: current status
      () => [
        { allAssertionsPassed: true, judgeResult: { overallScore: 8 } },
        { allAssertionsPassed: true, judgeResult: { overallScore: 6 } },
      ], // finalize: results
    );

    mockExecuteCase.mockResolvedValue({
      result: {
        caseId: "c1",
        caseName: "Case",
        mode: "single",
        turns: [],
        chatMessages: [],
        turnResults: [],
        chatResponse: "ok",
        assertionResults: [],
        allAssertionsPassed: true,
        judgeResult: null,
        timestamp: Date.now(),
        durationMs: 100,
      },
      chatUsage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 },
      judgeUsage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 },
    });

    await executeEvalRun({
      runId: "run-1",
      agentId: "agent-1",
      cases: baseCases,
      templateVars: {},
      toolNames: [],
      userId: "user-1",
    });

    // executeCase should be called for each case
    expect(mockExecuteCase).toHaveBeenCalledTimes(2);

    // Should insert results for each case
    expect(insertedResults).toHaveLength(2);

    // Should have updates: completedCases increment (x2) + finalize
    expect(updatedFields.length).toBeGreaterThanOrEqual(3);
  });

  it("skips cases when run is cancelled", async () => {
    selectResults.push(
      () => [baseRun], // load run
      () => [{ status: "cancelled" }], // cancel check — cancelled!
      () => [{ status: "cancelled" }], // finalize status check
      () => [], // finalize results
    );

    await executeEvalRun({
      runId: "run-1",
      agentId: "agent-1",
      cases: baseCases,
      templateVars: {},
      toolNames: [],
      userId: "user-1",
    });

    // executeCase should not be called since run was cancelled
    expect(mockExecuteCase).not.toHaveBeenCalled();
  });

  it("marks run as failed on unexpected error", async () => {
    selectResults.push(
      () => { throw new Error("DB connection failed"); },
    );

    await executeEvalRun({
      runId: "run-1",
      agentId: "agent-1",
      cases: baseCases,
      templateVars: {},
      toolNames: [],
      userId: "user-1",
    });

    // Should update status to "failed" with error message
    const failUpdate = updatedFields.find((f) => f.status === "failed");
    expect(failUpdate).toBeTruthy();
    expect(failUpdate?.error).toContain("DB connection failed");
  });
});
