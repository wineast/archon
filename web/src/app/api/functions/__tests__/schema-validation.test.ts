import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock db ──

const returningInsertMock = vi.fn(() => [{ id: "fn-1", key: "f", name: "F" }]);
const valuesMock = vi.fn(() => ({ returning: returningInsertMock }));
const insertMock = vi.fn(() => ({ values: valuesMock }));

const returningUpdateMock = vi.fn(() => [{ id: "fn-1", key: "f", name: "F" }]);
const whereUpdateMock = vi.fn(() => ({ returning: returningUpdateMock }));
const setMock = vi.fn(() => ({ where: whereUpdateMock }));
const updateMock = vi.fn(() => ({ set: setMock }));

let selectResult: unknown[] = [];
const whereSelectMock = vi.fn(() => selectResult);
const orderByMock = vi.fn(() => selectResult);
const fromMock = vi.fn(() => ({ where: whereSelectMock, orderBy: orderByMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    insert: () => insertMock(),
    update: () => updateMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  functions: { id: "id", agentId: "agentId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...c: unknown[]) => c,
  asc: (col: unknown) => col,
  isNull: (col: unknown) => ({ op: "isNull", col }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ user: { id: "user-1" }, agentId: "agent-1" }),
  requireSuperAdmin: vi.fn().mockResolvedValue({ id: "user-1", platformRole: "super_admin" }),
}));

vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: vi.fn() };
});

vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/functions/compile", () => ({ clearFunctionCache: vi.fn() }));
vi.mock("@/lib/pool/queries", () => ({
  getAgentResources: vi.fn().mockResolvedValue([]),
}));

const { POST } = await import("../route");
const { PATCH } = await import("../[id]/route");

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/functions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "agent-1", key: "f", name: "F", code: "() => {}", ...body }),
  });
}

function makePatchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/functions/fn-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const patchParams = Promise.resolve({ id: "fn-1" });

describe("POST /api/functions — schema validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-object parametersSchema", async () => {
    const res = await POST(makePostRequest({ parametersSchema: { type: "string" } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("parametersSchema");
  });

  it("rejects non-object returnParametersSchema", async () => {
    const res = await POST(makePostRequest({ returnParametersSchema: { type: "boolean" } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("returnParametersSchema");
  });

  it("accepts valid object schema", async () => {
    const res = await POST(makePostRequest({ parametersSchema: { type: "object", properties: {} } }));
    expect(res.status).toBe(201);
  });

  it("accepts null schema", async () => {
    const res = await POST(makePostRequest({ parametersSchema: null }));
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/functions/[id] — schema validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [{ id: "fn-1", agentId: "agent-1" }];
  });

  it("rejects non-object parametersSchema", async () => {
    const res = await PATCH(makePatchRequest({ parametersSchema: { type: "number" } }), { params: patchParams });
    expect(res.status).toBe(400);
  });

  it("accepts valid schema update", async () => {
    const res = await PATCH(makePatchRequest({ returnParametersSchema: { allOf: [{ type: "object" }] } }), { params: patchParams });
    expect(res.status).toBe(200);
  });
});
