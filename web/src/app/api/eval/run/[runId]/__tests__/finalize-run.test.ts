import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

let selectResults: Record<string, unknown>[] = [];
let updatedValues: Record<string, unknown> = {};

const whereUpdateMock = vi.fn();
const setMock = vi.fn((v: Record<string, unknown>) => {
  updatedValues = v;
  return { where: whereUpdateMock };
});
const updateMock = vi.fn(() => ({ set: setMock }));

const whereSelectMock = vi.fn(() => selectResults);
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id" },
  evalRunResults: { runId: "run_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

const { PATCH } = await import("../route");

const params = Promise.resolve({ runId: "run-1" });

function makeRequest() {
  return new Request("http://localhost/api/eval/run/run-1", {
    method: "PATCH",
  });
}

describe("PATCH /api/eval/run/[runId] (finalize)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatedValues = {};
    selectResults = [];
  });

  it("aggregates stats from results — all passed", async () => {
    selectResults = [
      { allAssertionsPassed: true, judgeResult: { overallScore: 8 } },
      { allAssertionsPassed: true, judgeResult: { overallScore: 6 } },
    ];

    const res = await PATCH(makeRequest(), { params });
    const json = await res.json();

    expect(json).toEqual({
      totalCases: 2,
      passedAssertions: 2,
      averageScore: 7,
    });
    expect(updatedValues).toEqual({
      totalCases: 2,
      passedAssertions: 2,
      averageScore: 7,
    });
  });

  it("handles mixed pass/fail results", async () => {
    selectResults = [
      { allAssertionsPassed: true, judgeResult: { overallScore: 9 } },
      { allAssertionsPassed: false, judgeResult: null },
      { allAssertionsPassed: true, judgeResult: { overallScore: 7 } },
    ];

    const res = await PATCH(makeRequest(), { params });
    const json = await res.json();

    expect(json).toEqual({
      totalCases: 3,
      passedAssertions: 2,
      averageScore: 8,
    });
  });

  it("returns null averageScore when no judge results", async () => {
    selectResults = [
      { allAssertionsPassed: false, judgeResult: null },
      { allAssertionsPassed: false, judgeResult: null },
    ];

    const res = await PATCH(makeRequest(), { params });
    const json = await res.json();

    expect(json).toEqual({
      totalCases: 2,
      passedAssertions: 0,
      averageScore: null,
    });
  });

  it("handles empty results (0 cases)", async () => {
    selectResults = [];

    const res = await PATCH(makeRequest(), { params });
    const json = await res.json();

    expect(json).toEqual({
      totalCases: 0,
      passedAssertions: 0,
      averageScore: null,
    });
  });

  it("rounds averageScore to 1 decimal place", async () => {
    selectResults = [
      { allAssertionsPassed: true, judgeResult: { overallScore: 7 } },
      { allAssertionsPassed: true, judgeResult: { overallScore: 8 } },
      { allAssertionsPassed: true, judgeResult: { overallScore: 9 } },
    ];

    const res = await PATCH(makeRequest(), { params });
    const json = await res.json();

    // (7 + 8 + 9) / 3 = 8.0
    expect(json.averageScore).toBe(8);
  });
});
