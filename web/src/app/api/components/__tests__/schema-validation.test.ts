import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock db ──

const returningInsertMock = vi.fn(() => [{ id: "comp-1", key: "c", name: "C" }]);
const valuesMock = vi.fn(() => ({ returning: returningInsertMock }));
const insertMock = vi.fn(() => ({ values: valuesMock }));

const returningUpdateMock = vi.fn(() => [{ id: "comp-1", key: "c", name: "C" }]);
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
  components: { id: "id", agentId: "agentId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...c: unknown[]) => c,
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
vi.mock("@/lib/components/compile-css", () => ({
  compileCssForComponent: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/pool/queries", () => ({
  getAgentResources: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockResolvedValue("mock-version-id"),
}));

const { POST } = await import("../route");
const { PATCH } = await import("../[id]/route");

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/components", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "agent-1", key: "c", name: "C", ...body }),
  });
}

function makePatchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/components/comp-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const patchParams = Promise.resolve({ id: "comp-1" });

describe("POST /api/components — schema validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-object toolInputSchema", async () => {
    const res = await POST(makePostRequest({ toolInputSchema: { type: "string" } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("toolInputSchema");
  });

  it("rejects non-object componentInputSchema", async () => {
    const res = await POST(makePostRequest({ componentInputSchema: { type: "array", items: {} } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("componentInputSchema");
  });

  it("accepts valid object schema", async () => {
    const res = await POST(makePostRequest({ toolInputSchema: { type: "object", properties: {} } }));
    expect(res.status).toBe(201);
  });

  it("accepts null schema", async () => {
    const res = await POST(makePostRequest({ toolInputSchema: null }));
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/components/[id] — schema validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [{ id: "comp-1", agentId: "agent-1" }];
  });

  it("rejects non-object toolInputSchema", async () => {
    const res = await PATCH(makePatchRequest({ toolInputSchema: { type: "number" } }), { params: patchParams });
    expect(res.status).toBe(400);
  });

  it("accepts valid schema update", async () => {
    const res = await PATCH(makePatchRequest({ toolInputSchema: { type: "object", properties: {} } }), { params: patchParams });
    expect(res.status).toBe(200);
  });

  it("accepts update without schema fields", async () => {
    const res = await PATCH(makePatchRequest({ name: "Updated" }), { params: patchParams });
    expect(res.status).toBe(200);
  });
});
