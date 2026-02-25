import { describe, it, expect, vi, beforeEach } from "vitest";
import { InngestTestEngine } from "@inngest/test";

// ── DB mock with sequential select results ──

let selectCallIndex = 0;
const selectResults: (() => unknown[])[] = [];

const mockSelectWhere = vi.fn(() => {
  const idx = selectCallIndex++;
  return selectResults[idx] ? selectResults[idx]() : [];
});
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockDbSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockOnConflictDoUpdate = vi.fn();
const mockInsertValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockDbInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockDbUpdate = vi.fn(() => ({ set: mockUpdateSet }));

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id", status: "status" },
  evalRunResults: { runId: "run_id", caseId: "case_id" },
  evalCases: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

const mockExecuteCase = vi.fn();
vi.mock("@/lib/eval/execute-case", () => ({
  executeCase: mockExecuteCase,
}));

const mockRecordUsage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/usage/record", () => ({
  recordUsage: mockRecordUsage,
}));

vi.mock("@/lib/eval/types", () => ({
  toEvalCase: (row: unknown) => row,
}));

const { evalCaseWorker } = await import("../eval-case-worker");

// ── Fixtures ──

const baseEvent = {
  name: "eval/case.execute" as const,
  data: {
    runId: "run-1",
    caseId: "c1",
    agentId: "agent-1",
    userId: "user-1",
    orgId: "org-1",
  },
};

const fullRun = {
  id: "run-1",
  status: "running",
  chatModel: "deepseek-chat",
  judgeModelConfigSnapshot: { modelId: "gpt-4o" },
  templateVars: {},
  toolNames: [],
};

const fullCase = {
  id: "c1",
  key: "test-case",
  name: "Test Case",
  mode: "single",
  turns: [],
  assertions: [],
  expectedOutput: "",
};

const mockResult = {
  caseId: "c1",
  caseName: "Test Case",
  mode: "single" as const,
  turns: [],
  chatMessages: [],
  turnResults: [],
  chatResponse: "Hello",
  assertionResults: [],
  allAssertionsPassed: true,
  judgeResult: null,
  error: null,
  durationMs: 100,
};

function setupNormalFlow(
  chatUsage = { inputTokens: 100, outputTokens: 50 },
  judgeUsage = { inputTokens: 0, outputTokens: 0 }
) {
  selectResults.push(
    () => [{ status: "running" }], // check-cancel
    () => [fullRun],               // execute → load run
    () => [fullCase],              // execute → load case
    () => [{ count: 5 }]          // save → count results
  );
  mockExecuteCase.mockResolvedValue({
    result: mockResult,
    chatUsage,
    judgeUsage,
  });
}

describe("eval-case-worker", () => {
  let t: InstanceType<typeof InngestTestEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    selectResults.length = 0;
    t = new InngestTestEngine({ function: evalCaseWorker });
  });

  it("B1: 正常执行并保存结果", async () => {
    setupNormalFlow();

    const { result, ctx, error } = await t.execute({
      events: [baseEvent],
    });

    expect(error).toBeUndefined();

    // All 3 steps called
    expect(ctx.step.run).toHaveBeenCalledWith(
      "check-cancel",
      expect.any(Function)
    );
    expect(ctx.step.run).toHaveBeenCalledWith(
      "execute",
      expect.any(Function)
    );
    expect(ctx.step.run).toHaveBeenCalledWith(
      "save",
      expect.any(Function)
    );
    // executeCase was called
    expect(mockExecuteCase).toHaveBeenCalledTimes(1);
    // Upsert (insert with onConflictDoUpdate)
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    // COUNT update
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    // Chat usage recorded (inputTokens=100, outputTokens=50 > 0)
    expect(mockRecordUsage).toHaveBeenCalledTimes(1);
    // Correct return
    expect(result).toEqual({ status: "completed", caseId: "c1" });
  });

  it("B2: Run 已取消 — skip", async () => {
    selectResults.push(
      () => [{ status: "cancelled" }] // check-cancel → cancelled
    );

    const { result, ctx, error } = await t.execute({
      events: [baseEvent],
    });

    expect(error).toBeUndefined();

    // Only check-cancel called
    expect(ctx.step.run).toHaveBeenCalledWith(
      "check-cancel",
      expect.any(Function)
    );
    // execute and save NOT called
    expect(ctx.step.run).not.toHaveBeenCalledWith(
      "execute",
      expect.any(Function)
    );
    expect(ctx.step.run).not.toHaveBeenCalledWith(
      "save",
      expect.any(Function)
    );
    expect(mockExecuteCase).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "skipped" });
  });

  it("B3: Case 不存在 — execute 抛错", async () => {
    selectResults.push(
      () => [{ status: "running" }], // check-cancel
      () => [fullRun],               // execute → load run (exists)
      () => []                       // execute → load case (empty → throws)
    );

    const { error } = await t.execute({
      events: [baseEvent],
    });

    expect(error).toBeDefined();
    expect((error as { message: string }).message).toContain(
      "Case c1 not found"
    );
    // save should NOT run after execute throws
    expect(mockRecordUsage).not.toHaveBeenCalled();
  });

  it("B4: 零用量不记录 recordUsage", async () => {
    setupNormalFlow(
      { inputTokens: 0, outputTokens: 0 },
      { inputTokens: 0, outputTokens: 0 }
    );

    const { error } = await t.execute({
      events: [baseEvent],
    });

    expect(error).toBeUndefined();
    expect(mockRecordUsage).not.toHaveBeenCalled();
  });

  it("B5: Chat 和 Judge 用量分开记录", async () => {
    setupNormalFlow(
      { inputTokens: 100, outputTokens: 50 },
      { inputTokens: 300, outputTokens: 100 }
    );

    const { error } = await t.execute({
      events: [baseEvent],
    });

    expect(error).toBeUndefined();
    expect(mockRecordUsage).toHaveBeenCalledTimes(2);
    // Chat usage
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "deepseek-chat",
        usage: { inputTokens: 100, outputTokens: 50 },
        source: "eval",
      })
    );
    // Judge usage
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "gpt-4o",
        usage: { inputTokens: 300, outputTokens: 100 },
        source: "eval",
      })
    );
  });
});
