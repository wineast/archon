import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

let updatedFields: Record<string, unknown>[] = [];

const whereUpdateMock = vi.fn();
const setMock = vi.fn((v: Record<string, unknown>) => {
  updatedFields.push(v);
  return { where: whereUpdateMock };
});
const updateMock = vi.fn(() => ({ set: setMock }));

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
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id", status: "status" },
  evalRunResults: { runId: "run_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

const { isRunCancelled, finalizeRun } = await import("../execute-run");

describe("isRunCancelled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    selectResults.length = 0;
  });

  it("returns true when status is cancelled", async () => {
    selectResults.push(() => [{ status: "cancelled" }]);
    expect(await isRunCancelled("run-1")).toBe(true);
  });

  it("returns false when status is running", async () => {
    selectResults.push(() => [{ status: "running" }]);
    expect(await isRunCancelled("run-1")).toBe(false);
  });

  it("returns false when run not found", async () => {
    selectResults.push(() => []);
    expect(await isRunCancelled("run-1")).toBe(false);
  });
});

describe("finalizeRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatedFields = [];
    selectCallIndex = 0;
    selectResults.length = 0;
  });

  it("aggregates results and sets status to completed", async () => {
    selectResults.push(
      () => [{ status: "running" }], // current status
      () => [
        { allAssertionsPassed: true, judgeResult: { overallScore: 8 } },
        { allAssertionsPassed: false, judgeResult: { overallScore: 6 } },
      ], // results
    );

    await finalizeRun("run-1");

    expect(updatedFields).toHaveLength(1);
    expect(updatedFields[0]).toMatchObject({
      totalCases: 2,
      passedAssertions: 1,
      averageScore: 7,
      status: "completed",
    });
  });

  it("preserves cancelled status", async () => {
    selectResults.push(
      () => [{ status: "cancelled" }],
      () => [{ allAssertionsPassed: true, judgeResult: null }],
    );

    await finalizeRun("run-1");

    expect(updatedFields[0]).toMatchObject({ status: "cancelled" });
  });

  it("handles no results gracefully", async () => {
    selectResults.push(
      () => [{ status: "running" }],
      () => [],
    );

    await finalizeRun("run-1");

    expect(updatedFields[0]).toMatchObject({
      totalCases: 0,
      passedAssertions: 0,
      averageScore: null,
      status: "completed",
    });
  });

  it("does nothing if run not found", async () => {
    selectResults.push(() => []);

    await finalizeRun("run-1");

    expect(updatedFields).toHaveLength(0);
  });
});
