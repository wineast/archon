import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Chain helpers
function chainReturning(rows: unknown[]) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function chainSelect(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function chainDelete() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get(_, prop) {
        return (mockDb as Record<string, unknown>)[prop as string];
      },
    }
  ),
}));

vi.mock("@/db/schema", () => ({
  users: { clerkId: "clerk_id", id: "id", deletedAt: "deleted_at" },
  orgs: { id: "id", isPersonal: "is_personal" },
  orgMembers: { orgId: "org_id", userId: "user_id" },
}));

const deleteUserMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  createClerkClient: () => ({
    users: { deleteUser: deleteUserMock },
  }),
}));

vi.stubEnv("CLERK_SECRET_KEY", "sk_test_xxx");

const {
  initiateAccountDeletion,
  cancelAccountDeletion,
  cleanupDeletedUsers,
  immediateDeleteUser,
  ACCOUNT_DELETION_GRACE_DAYS,
} = await import("../account-deletion");

describe("account-deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ACCOUNT_DELETION_GRACE_DAYS", () => {
    it("equals 7", () => {
      expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(7);
    });
  });

  describe("initiateAccountDeletion", () => {
    it("sets deletedAt on user", async () => {
      const updated = { id: "u1", clerkId: "clerk_1", deletedAt: new Date() };
      mockDb.update.mockReturnValue(chainReturning([updated]));

      const result = await initiateAccountDeletion("clerk_1");
      expect(result).toEqual(updated);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("throws if user not found", async () => {
      mockDb.update.mockReturnValue(chainReturning([]));

      await expect(initiateAccountDeletion("nonexistent")).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("cancelAccountDeletion", () => {
    it("clears deletedAt on user", async () => {
      const updated = { id: "u1", clerkId: "clerk_1", deletedAt: null };
      mockDb.update.mockReturnValue(chainReturning([updated]));

      const result = await cancelAccountDeletion("clerk_1");
      expect(result).toEqual(updated);
    });

    it("throws if user not found", async () => {
      mockDb.update.mockReturnValue(chainReturning([]));

      await expect(cancelAccountDeletion("nonexistent")).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("cleanupDeletedUsers", () => {
    it("deletes expired users and their personal orgs", async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10);

      const expiredUser = { id: "u1", clerkId: "clerk_1", deletedAt: expiredDate };

      // First call: select expired users
      mockDb.select.mockReturnValueOnce(chainSelect([expiredUser]));
      // Second call: select personal orgs
      mockDb.select.mockReturnValueOnce(chainSelect([{ orgId: "org1" }]));
      // Update org (soft delete)
      mockDb.update.mockReturnValue(chainReturning([{}]));
      // Delete user row
      mockDb.delete.mockReturnValue(chainDelete());
      deleteUserMock.mockResolvedValue({});

      const result = await cleanupDeletedUsers();
      expect(result).toEqual({ deleted: 1, total: 1 });
      expect(deleteUserMock).toHaveBeenCalledWith("clerk_1");
    });

    it("returns zero when no expired users", async () => {
      mockDb.select.mockReturnValueOnce(chainSelect([]));

      const result = await cleanupDeletedUsers();
      expect(result).toEqual({ deleted: 0, total: 0 });
    });
  });

  describe("immediateDeleteUser", () => {
    it("permanently deletes user immediately", async () => {
      const user = { id: "u1", clerkId: "clerk_1" };

      mockDb.select.mockReturnValueOnce(chainSelect([user]));
      // Personal orgs lookup
      mockDb.select.mockReturnValueOnce(chainSelect([]));
      mockDb.delete.mockReturnValue(chainDelete());
      deleteUserMock.mockResolvedValue({});

      const result = await immediateDeleteUser("clerk_1");
      expect(result).toEqual({ ok: true });
    });

    it("throws if user not found", async () => {
      mockDb.select.mockReturnValueOnce(chainSelect([]));

      await expect(immediateDeleteUser("nonexistent")).rejects.toThrow(
        "User not found"
      );
    });
  });
});
