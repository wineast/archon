import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──
const { mockRestoreSnapshot, mockValidate, mockMigrate, mockEnsureSlug, mockRequireOrgRole, mockDel, mockPut, mockFetch } = vi.hoisted(() => ({
  mockRestoreSnapshot: vi.fn(),
  mockValidate: vi.fn(() => true),
  mockMigrate: vi.fn((d: unknown) => d),
  mockEnsureSlug: vi.fn(() => "imported-agent"),
  mockRequireOrgRole: vi.fn(() => ({ user: { id: "user-1" } })),
  mockDel: vi.fn(() => Promise.resolve()),
  mockPut: vi.fn(() => Promise.resolve({ url: "https://blob.test/file.png" })),
  mockFetch: vi.fn(),
}));

// ── DB mock ──
const insertedRows: { table: string; data: unknown }[] = [];
const insertReturns: unknown[][] = [];
let insertIdx = 0;
let selectIdx = 0;
const selectResults: unknown[][] = [];

const returningMock = vi.fn(() => {
  return insertReturns[insertIdx++] ?? [{ id: `gen-${insertIdx}` }];
});
const valuesMock = vi.fn((v: unknown) => {
  insertedRows.push({ table: "unknown", data: v });
  return { returning: returningMock };
});
const insertMock = vi.fn(() => ({ values: valuesMock }));
const whereMock = vi.fn(() => {
  const data = selectResults[selectIdx++] ?? [];
  return Object.assign([...data], { limit: () => data });
});
const fromMock = vi.fn(() => ({ where: whereMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));
const setMock = vi.fn(() => ({ where: vi.fn() }));
const updateMock = vi.fn(() => ({ set: setMock }));

vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: () => insertMock(),
        select: () => selectMock(),
        update: () => updateMock(),
      };
      return fn(tx);
    }),
    select: () => selectMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: { id: "agents.id" },
  agentMembers: { id: "agentMembers.id" },
  agentVersions: { id: "agentVersions.id", agentId: "agentVersions.agentId" },
  agentFiles: { id: "agentFiles.id" },
  embedTokens: { id: "embedTokens.id" },
  orgs: { id: "orgs.id", slug: "orgs.slug" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock("@/lib/versions/snapshot", () => ({
  restoreSnapshot: mockRestoreSnapshot,
}));

vi.mock("@/lib/versions/types", () => ({
  validateExportData: mockValidate,
}));

vi.mock("@/lib/versions/migrations", () => ({
  migrateExportData: mockMigrate,
}));

vi.mock("@/lib/agents/slug", () => ({
  ensureUniqueSlug: mockEnsureSlug,
}));

vi.mock("@/lib/auth/require-org-role", () => ({
  requireOrgRole: mockRequireOrgRole,
}));

vi.mock("@vercel/blob", () => ({
  del: mockDel,
  put: mockPut,
}));

vi.mock("jszip", () => {
  return {
    default: {
      loadAsync: vi.fn(() => ({
        file: vi.fn((name: string) => {
          if (name === "manifest.json") {
            return {
              async: vi.fn(() => JSON.stringify(makeExportData())),
            };
          }
          // For file entries (e.g., "files/test.png")
          return {
            async: vi.fn(() => Buffer.from("file-content")),
          };
        }),
      })),
    },
  };
});

// Mock global fetch for blob URL fetching
vi.stubGlobal("fetch", mockFetch);

const { POST } = await import("../route");

// ── Helpers ──
function makeExportData() {
  return {
    exportVersion: 1,
    exportedAt: "2024-01-01",
    agent: {
      name: "Test Agent",
      description: "desc",
      icon: "🤖",
      slug: "test-agent",
      isPublic: false,
      mcpEnabled: false,
      memoryEnabled: false,
      ragEnabled: false,
      skillsEnabled: false,
      contextCompressionEnabled: false,
    },
    versions: [
      {
        version: "1.0.0",
        changelog: "",
        snapshot: { tools: [], functions: [], components: [], schemas: [], wikiDocuments: [], datasets: [], modelConfigs: [], chatConfig: null, memoryConfig: null, evalCases: [], judgeConfigs: [], objectTypes: [], objectRelations: [], mcpServers: [], skills: [], resourceRefs: [], agent: { name: "Test Agent", description: "desc", icon: "🤖", slug: "test-agent", isPublic: false } },
        isEditing: true,
        isPublished: true,
      },
    ],
    files: [],
    embedTokens: [],
  };
}

function makeRequest(body: Record<string, unknown>, orgId = "org-1") {
  return new Request(`http://localhost/api/agents/import?orgId=${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedRows.length = 0;
  insertIdx = 0;
  selectIdx = 0;
  insertReturns.length = 0;
  selectResults.length = 0;

  // Only inserts that call .returning() consume from this array:
  // 1. agents insert → .returning()
  insertReturns.push([{ id: "agent-1", name: "Test Agent", description: "desc", icon: "🤖", slug: "test-agent", isPublic: false }]);
  // 2. agentVersions insert → .returning() (agentMembers does NOT call .returning())
  insertReturns.push([{ id: "version-1", version: "1.0.0" }]);

  // Org slug query
  selectResults.push([{ slug: "test-org" }]);

  // Mock fetch for blob
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  });
});

/* ═══════════════════════════════════════════════ */

describe("POST /api/agents/import", () => {
  it("returns 400 when orgId is missing", async () => {
    const req = new Request("http://localhost/api/agents/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobUrl: "https://blob.test/file.zip" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("orgId");
  });

  it("returns 400 when blobUrl is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("blobUrl");
  });

  it("returns 400 when blobUrl is not a string", async () => {
    const res = await POST(makeRequest({ blobUrl: 123 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("blobUrl");
  });

  it("passes through auth rejection from requireOrgRole", async () => {
    const { NextResponse } = await import("next/server");
    const authResponse = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockRequireOrgRole.mockReturnValueOnce(authResponse as any);

    const res = await POST(makeRequest({ blobUrl: "https://blob.test/file.zip" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 and cleans up blob on ZIP parse failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const res = await POST(makeRequest({ blobUrl: "https://blob.test/bad.zip" }));
    expect(res.status).toBe(400);
    expect(mockDel).toHaveBeenCalledWith("https://blob.test/bad.zip");
  });

  it("returns 400 when validateExportData fails", async () => {
    mockValidate.mockReturnValueOnce(false);

    const res = await POST(makeRequest({ blobUrl: "https://blob.test/file.zip" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid export file format");
  });

  it("creates agent and returns 201 on successful import", async () => {
    const res = await POST(makeRequest({ blobUrl: "https://blob.test/file.zip" }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("agent-1");
    expect(json.myRole).toBe("owner");
    expect(json.orgSlug).toBe("test-org");
  });

  it("calls restoreSnapshot for each version with snapshot", async () => {
    await POST(makeRequest({ blobUrl: "https://blob.test/file.zip" }));

    expect(mockRestoreSnapshot).toHaveBeenCalledTimes(1);
    const [agentId, versionId, snapshot] = mockRestoreSnapshot.mock.calls[0];
    expect(agentId).toBe("agent-1");
    expect(versionId).toBe("version-1");
    expect(snapshot).toHaveProperty("tools");
  });

  it("calls ensureUniqueSlug with agent slug and orgId", async () => {
    await POST(makeRequest({ blobUrl: "https://blob.test/file.zip" }));

    expect(mockEnsureSlug).toHaveBeenCalledWith("test-agent", "org-1");
  });

  it("cleans up temporary blob after successful import", async () => {
    await POST(makeRequest({ blobUrl: "https://blob.test/file.zip" }));

    expect(mockDel).toHaveBeenCalledWith("https://blob.test/file.zip");
  });
});
