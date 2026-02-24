import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

let selectRunResult: Record<string, unknown>[] = [];
let updatedValues: Record<string, unknown> = {};

const whereUpdateMock = vi.fn();
const setMock = vi.fn((v: Record<string, unknown>) => {
  updatedValues = v;
  return { where: whereUpdateMock };
});
const updateMock = vi.fn(() => ({ set: setMock }));

const whereSelectMock = vi.fn(() => selectRunResult);
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
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ agentId: "agent-1" }),
}));

const { POST } = await import("../route");

const params = Promise.resolve({ runId: "run-1" });

function makeRequest() {
  return new Request("http://localhost/api/eval/run/run-1/cancel", {
    method: "POST",
  });
}

describe("POST /api/eval/run/[runId]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatedValues = {};
    selectRunResult = [{ id: "run-1", agentId: "agent-1", status: "running" }];
  });

  it("cancels a running run", async () => {
    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    expect(updatedValues).toEqual({ status: "cancelled" });
  });

  it("returns 404 if run not found", async () => {
    selectRunResult = [];

    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 400 if run is not running", async () => {
    selectRunResult = [{ id: "run-1", agentId: "agent-1", status: "completed" }];

    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("not in running state");
  });

  it("returns 400 if run has no agentId", async () => {
    selectRunResult = [{ id: "run-1", agentId: null, status: "running" }];

    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(400);
  });
});
