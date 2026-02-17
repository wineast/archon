import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock db with chainable Drizzle-style API ──

let selectResult: unknown[] = [];
let setPayload: Record<string, unknown> = {};

const returningMock = vi.fn(() => [{ id: "case-1", tags: ["tag-a"] }]);
const whereUpdateMock = vi.fn(() => ({ returning: returningMock }));
const setMock = vi.fn((payload: Record<string, unknown>) => {
  setPayload = payload;
  return { where: whereUpdateMock };
});
const updateMock = vi.fn(() => ({ set: setMock }));
const whereSelectMock = vi.fn(() => selectResult);
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  evalCases: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

// ── Import handler after mocks are set up ──

const { PUT } = await import("../[id]/route");

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/eval/cases/case-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "case-1" });

describe("PUT /api/eval/cases/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPayload = {};
    selectResult = [{ id: "case-1" }];
  });

  it("includes tags in the update payload", async () => {
    const tags = ["regression", "important"];
    const res = await PUT(makeRequest({ tags }), { params });

    expect(res.status).toBe(200);
    expect(setPayload).toEqual({ tags });
  });

  it("includes tags alongside other fields", async () => {
    const body = { name: "updated", tags: ["new-tag"] };
    await PUT(makeRequest(body), { params });

    expect(setPayload).toEqual({ name: "updated", tags: ["new-tag"] });
  });

  it("handles empty tags array", async () => {
    await PUT(makeRequest({ tags: [] }), { params });

    expect(setPayload).toEqual({ tags: [] });
  });

  it("does not include tags when not provided", async () => {
    await PUT(makeRequest({ name: "only-name" }), { params });

    expect(setPayload).toEqual({ name: "only-name" });
    expect(setPayload).not.toHaveProperty("tags");
  });

  it("returns 404 when case not found", async () => {
    selectResult = [];
    const res = await PUT(makeRequest({ tags: ["x"] }), { params });

    expect(res.status).toBe(404);
  });
});
