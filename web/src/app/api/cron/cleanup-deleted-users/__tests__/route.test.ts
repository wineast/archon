import { describe, it, expect, vi, beforeEach } from "vitest";

const cleanupDeletedUsersMock = vi.fn();

vi.mock("@/lib/auth/account-deletion", () => ({
  cleanupDeletedUsers: () => cleanupDeletedUsersMock(),
}));

const CRON_SECRET = "test-secret-123";
vi.stubEnv("CRON_SECRET", CRON_SECRET);

const { GET } = await import("../route");

function makeRequest(authorization?: string) {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  return new Request("http://localhost/api/cron/cleanup-deleted-users", { headers });
}

describe("GET /api/cron/cleanup-deleted-users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authorization header", async () => {
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret") as never);
    expect(res.status).toBe(401);
  });

  it("returns cleanup result with valid secret", async () => {
    cleanupDeletedUsersMock.mockResolvedValue({ deleted: 3, total: 3 });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, deleted: 3, total: 3 });
  });
});
