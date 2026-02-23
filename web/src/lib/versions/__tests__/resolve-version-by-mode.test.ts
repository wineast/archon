import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
const mockDb = {
  select: vi.fn(),
};
vi.mock("@/db", () => ({ db: mockDb }));
vi.mock("@/db/schema", () => ({
  agents: {
    id: "id",
    editingVersionId: "editing_version_id",
    publishedVersionId: "published_version_id",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

// Create chainable query builder mock
function createQueryChain(result: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  mockDb.select.mockReturnValue(chain);
  return chain;
}

describe("resolveVersionByMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns published version ID when mode is "published"', async () => {
    createQueryChain([{ publishedVersionId: "pub-v1" }]);

    const { resolveVersionByMode } = await import("../resolve");
    const result = await resolveVersionByMode("agent-1", "published");
    expect(result).toBe("pub-v1");
  });

  it("returns null when mode is published but agent has no published version", async () => {
    createQueryChain([{ publishedVersionId: null }]);

    const { resolveVersionByMode } = await import("../resolve");
    const result = await resolveVersionByMode("agent-1", "published");
    expect(result).toBeNull();
  });

  it("returns null when mode is published and agent not found", async () => {
    createQueryChain([]);

    const { resolveVersionByMode } = await import("../resolve");
    const result = await resolveVersionByMode("agent-1", "published");
    expect(result).toBeNull();
  });

  it("returns editing version ID when mode is null", async () => {
    createQueryChain([{ editingVersionId: "edit-v1" }]);

    const { resolveVersionByMode } = await import("../resolve");
    const result = await resolveVersionByMode("agent-1", null);
    expect(result).toBe("edit-v1");
  });

  it("throws when mode is null and agent has no editing version", async () => {
    createQueryChain([{ editingVersionId: null }]);

    const { resolveVersionByMode } = await import("../resolve");
    await expect(resolveVersionByMode("agent-1", null)).rejects.toThrow(
      "has no editing version"
    );
  });
});
