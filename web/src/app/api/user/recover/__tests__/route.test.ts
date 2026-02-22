import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUser = { id: "u1", clerkId: "clerk_1", email: "test@test.com", deletedAt: null };

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const ensureUserMock = vi.fn();
vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: (...args: unknown[]) => ensureUserMock(...args),
}));

const cancelAccountDeletionMock = vi.fn();
vi.mock("@/lib/auth/account-deletion", () => ({
  cancelAccountDeletion: (...args: unknown[]) => cancelAccountDeletionMock(...args),
}));

const { POST } = await import("../route");

describe("POST /api/user/recover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if not authenticated", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("cancels account deletion", async () => {
    authMock.mockResolvedValue({ userId: "clerk_1" });
    ensureUserMock.mockResolvedValue({ ...mockUser, deletedAt: new Date() });
    cancelAccountDeletionMock.mockResolvedValue(mockUser);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deletedAt).toBeNull();
    expect(cancelAccountDeletionMock).toHaveBeenCalledWith("clerk_1");
  });
});
