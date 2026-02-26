import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

let selectCallIndex = 0;
const selectResults: (() => unknown[])[] = [];

const whereSelectMock = vi.fn(() => {
  const idx = selectCallIndex++;
  return selectResults[idx] ? selectResults[idx]() : [];
});
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

let updatedFields: Record<string, unknown>[] = [];
const whereUpdateMock = vi.fn();
const setMock = vi.fn((v: Record<string, unknown>) => {
  updatedFields.push(v);
  return { where: whereUpdateMock };
});
const updateMock = vi.fn(() => ({ set: setMock }));

const whereDeleteMock = vi.fn();
const deleteMock = vi.fn(() => ({ where: whereDeleteMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
    delete: () => deleteMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id", agentId: "agent_id", status: "status" },
  evalRunResults: { id: "id", runId: "run_id", caseId: "case_id", error: "error" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNotNull: (col: unknown) => ({ op: "isNotNull", col }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ agentId: "agent-1", user: { id: "user-1" } }),
}));

const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["evt-1"] });
vi.mock("@/inngest/client", () => ({
  inngest: { send: (...args: unknown[]) => inngestSendMock(...args) },
}));

const { POST } = await import("../route");

function makeParams(runId: string) {
  return { params: Promise.resolve({ runId }) };
}

const completedRun = {
  id: "run-1",
  agentId: "agent-1",
  status: "completed",
};

describe("POST /api/eval/run/[runId]/retry-failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatedFields = [];
    selectCallIndex = 0;
    selectResults.length = 0;
  });

  it("retries failed cases and sends inngest event", async () => {
    selectResults.push(
      () => [completedRun], // load run
      () => [{ id: "r1", caseId: "c1" }, { id: "r2", caseId: "c2" }], // failed results
      () => [{ count: 3 }], // remaining results count
    );

    const res = await POST(new Request("http://localhost"), makeParams("run-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, retriedCases: 2 });
    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "eval/run.created",
      data: {
        runId: "run-1",
        agentId: "agent-1",
        caseIds: ["c1", "c2"],
        userId: "user-1",
      },
    });
  });

  it("returns 404 if run not found", async () => {
    selectResults.push(() => []);

    const res = await POST(new Request("http://localhost"), makeParams("run-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 if run is still running", async () => {
    selectResults.push(() => [{ ...completedRun, status: "running" }]);

    const res = await POST(new Request("http://localhost"), makeParams("run-1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("completed or failed");
  });

  it("returns 400 if no failed cases", async () => {
    selectResults.push(
      () => [completedRun],
      () => [], // no failed results
    );

    const res = await POST(new Request("http://localhost"), makeParams("run-1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("No failed cases");
  });

  it("updates run status to running", async () => {
    selectResults.push(
      () => [completedRun],
      () => [{ id: "r1", caseId: "c1" }],
      () => [{ count: 5 }],
    );

    await POST(new Request("http://localhost"), makeParams("run-1"));

    expect(updatedFields[0]).toMatchObject({
      status: "running",
      completedCases: 5,
      error: null,
    });
  });

  it("C1: 只重试执行错误，不重试断言失败", async () => {
    selectResults.push(
      () => [completedRun],
      () => [
        // r1: execution error → should retry
        { id: "r1", caseId: "c1", error: "timeout" },
        // r2: assertion failure (error IS NOT NULL filter matches, but note:
        // the route uses isNotNull(error), so r2 with error=null won't be returned)
        // r3: passed — also won't be returned by the isNotNull filter
      ],
      () => [{ count: 2 }], // remaining count
    );

    const res = await POST(new Request("http://localhost"), makeParams("run-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    // Only r1 (execution error) is retried
    expect(json).toEqual({ ok: true, retriedCases: 1 });
    expect(inngestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseIds: ["c1"],
        }),
      })
    );
  });

  it("C2: failed 状态的 run 也可 retry", async () => {
    const failedRun = { ...completedRun, status: "failed" };
    selectResults.push(
      () => [failedRun],
      () => [{ id: "r1", caseId: "c1" }, { id: "r2", caseId: "c2" }],
      () => [{ count: 3 }],
    );

    const res = await POST(new Request("http://localhost"), makeParams("run-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, retriedCases: 2 });
    // run status updated to running
    expect(updatedFields[0]).toMatchObject({ status: "running" });
  });

  it("C3: inngest.send 失败 — 错误直接抛出，状态已被污染", async () => {
    inngestSendMock.mockRejectedValueOnce(new Error("Inngest send failed"));

    selectResults.push(
      () => [completedRun],
      () => [{ id: "r1", caseId: "c1" }],
      () => [{ count: 4 }],
    );

    // Current implementation: no try/catch around inngest.send → error propagates
    await expect(
      POST(new Request("http://localhost"), makeParams("run-1"))
    ).rejects.toThrow("Inngest send failed");

    // Known issue: DB operations (delete results + update status) already executed
    // before inngest.send, so state is polluted on send failure.
    // TODO: Wrap in transaction or move inngest.send before DB mutations.
    expect(deleteMock).toHaveBeenCalled();
    expect(updatedFields[0]).toMatchObject({ status: "running" });
  });
});
