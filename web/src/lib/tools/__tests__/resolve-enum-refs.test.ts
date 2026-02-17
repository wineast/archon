import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolParameter } from "../types";

// Mock the db module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// We need to mock the chained query builder
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

function setupMockChain(results: unknown[]) {
  mockOrderBy.mockResolvedValue(results);
  mockWhere.mockReturnValue({ orderBy: mockOrderBy });
  mockFrom.mockReturnValue({ where: mockWhere });
  return { from: mockFrom, where: mockWhere };
}

describe("resolveEnumRefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip parameters without enumRef", async () => {
    const { db } = await import("@/db");

    const params: ToolParameter[] = [
      {
        id: "1",
        name: "test",
        type: "string",
        description: "test",
        required: true,
        enum: ["a", "b"],
      },
    ];

    const { resolveEnumRefs } = await import("../resolve-enum-refs");
    await resolveEnumRefs(params);

    // db.select should not have been called
    expect(db.select).not.toHaveBeenCalled();
    expect(params[0].enum).toEqual(["a", "b"]);
  });

  it("should skip parameters with enumRef that already have enum values", async () => {
    const { db } = await import("@/db");

    const params: ToolParameter[] = [
      {
        id: "1",
        name: "test",
        type: "string",
        description: "test",
        required: true,
        enum: ["existing"],
        enumRef: "some_table",
      },
    ];

    const { resolveEnumRefs } = await import("../resolve-enum-refs");
    await resolveEnumRefs(params);

    expect(db.select).not.toHaveBeenCalled();
    expect(params[0].enum).toEqual(["existing"]);
  });
});
