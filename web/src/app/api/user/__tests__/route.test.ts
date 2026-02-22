import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUser = { id: "u1", clerkId: "clerk_1", email: "test@test.com", deletedAt: null };
const mockDeletedUser = { ...mockUser, deletedAt: new Date() };

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const ensureUserMock = vi.fn();
vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: (...args: unknown[]) => ensureUserMock(...args),
}));

const initiateAccountDeletionMock = vi.fn();
vi.mock("@/lib/auth/account-deletion", () => ({
  initiateAccountDeletion: (...args: unknown[]) => initiateAccountDeletionMock(...args),
}));

vi.mock("@/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  users: { clerkId: "clerk_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

const { GET, PUT, DELETE } = await import("../route");

describe("/api/user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 if not authenticated", async () => {
      authMock.mockResolvedValue({ userId: null });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns user data", async () => {
      authMock.mockResolvedValue({ userId: "clerk_1" });
      ensureUserMock.mockResolvedValue(mockUser);

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe("u1");
    });
  });

  describe("DELETE", () => {
    it("returns 401 if not authenticated", async () => {
      authMock.mockResolvedValue({ userId: null });
      const res = await DELETE();
      expect(res.status).toBe(401);
    });

    it("initiates account deletion", async () => {
      authMock.mockResolvedValue({ userId: "clerk_1" });
      ensureUserMock.mockResolvedValue(mockUser);
      initiateAccountDeletionMock.mockResolvedValue(mockDeletedUser);

      const res = await DELETE();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.deletedAt).toBeTruthy();
      expect(initiateAccountDeletionMock).toHaveBeenCalledWith("clerk_1");
    });
  });
});
