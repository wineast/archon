import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: mockFrom }),
    update: () => ({ set: mockSet }),
  },
}));

vi.mock("@/db/schema", () => ({
  evalBatches: { id: "id", status: "status" },
  evalRuns: { batchId: "batch_id" },
}));

// Import after mocks
import { finalizeBatch, isBatchCancelled } from "../execute-batch";

describe("isBatchCancelled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when batch status is cancelled", async () => {
    mockFrom.mockReturnValue({
      where: vi.fn().mockResolvedValue([{ status: "cancelled" }]),
    });

    const result = await isBatchCancelled("batch-1");
    expect(result).toBe(true);
  });

  it("returns false when batch status is running", async () => {
    mockFrom.mockReturnValue({
      where: vi.fn().mockResolvedValue([{ status: "running" }]),
    });

    const result = await isBatchCancelled("batch-1");
    expect(result).toBe(false);
  });

  it("returns false when batch not found", async () => {
    mockFrom.mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });

    const result = await isBatchCancelled("nonexistent");
    expect(result).toBe(false);
  });
});

describe("finalizeBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets status to completed when all runs have scores", async () => {
    // Mock batch select
    const batchWhere = vi.fn().mockResolvedValue([{
      id: "batch-1",
      status: "running",
      repeatCount: 3,
    }]);
    // Mock runs select
    const runsWhere = vi.fn().mockResolvedValue([
      { id: "run-1", passedAssertions: 3, averageScore: 8.0, status: "completed" },
      { id: "run-2", passedAssertions: 2, averageScore: 7.0, status: "completed" },
      { id: "run-3", passedAssertions: 3, averageScore: 9.0, status: "completed" },
    ]);

    mockFrom
      .mockReturnValueOnce({ where: batchWhere })
      .mockReturnValueOnce({ where: runsWhere });

    const setWhere = vi.fn().mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: setWhere });

    await finalizeBatch("batch-1");

    // Verify update was called with correct aggregated values
    expect(mockSet).toHaveBeenCalledWith({
      passedAssertions: 8, // 3 + 2 + 3
      averageScore: 8.0, // (8+7+9)/3 = 8.0
      scoreStdDev: 0.82, // std dev of [8,7,9]
      minScore: 7.0,
      maxScore: 9.0,
      status: "completed",
    });
  });

  it("preserves cancelled status even when runs complete", async () => {
    const batchWhere = vi.fn().mockResolvedValue([{
      id: "batch-1",
      status: "cancelled",
    }]);
    const runsWhere = vi.fn().mockResolvedValue([
      { id: "run-1", passedAssertions: 3, averageScore: 8.0, status: "completed" },
    ]);

    mockFrom
      .mockReturnValueOnce({ where: batchWhere })
      .mockReturnValueOnce({ where: runsWhere });

    const setWhere = vi.fn().mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: setWhere });

    await finalizeBatch("batch-1");

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("handles batch with no runs", async () => {
    const batchWhere = vi.fn().mockResolvedValue([{
      id: "batch-1",
      status: "running",
    }]);
    const runsWhere = vi.fn().mockResolvedValue([]);

    mockFrom
      .mockReturnValueOnce({ where: batchWhere })
      .mockReturnValueOnce({ where: runsWhere });

    const setWhere = vi.fn().mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: setWhere });

    await finalizeBatch("batch-1");

    expect(mockSet).toHaveBeenCalledWith({ status: "completed" });
  });

  it("handles single run (no stdDev)", async () => {
    const batchWhere = vi.fn().mockResolvedValue([{
      id: "batch-1",
      status: "running",
    }]);
    const runsWhere = vi.fn().mockResolvedValue([
      { id: "run-1", passedAssertions: 3, averageScore: 8.5, status: "completed" },
    ]);

    mockFrom
      .mockReturnValueOnce({ where: batchWhere })
      .mockReturnValueOnce({ where: runsWhere });

    const setWhere = vi.fn().mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: setWhere });

    await finalizeBatch("batch-1");

    expect(mockSet).toHaveBeenCalledWith({
      passedAssertions: 3,
      averageScore: 8.5,
      scoreStdDev: null,
      minScore: 8.5,
      maxScore: 8.5,
      status: "completed",
    });
  });

  it("sets failed status when any run failed", async () => {
    const batchWhere = vi.fn().mockResolvedValue([{
      id: "batch-1",
      status: "running",
    }]);
    const runsWhere = vi.fn().mockResolvedValue([
      { id: "run-1", passedAssertions: 3, averageScore: 8.0, status: "completed" },
      { id: "run-2", passedAssertions: 0, averageScore: null, status: "failed" },
    ]);

    mockFrom
      .mockReturnValueOnce({ where: batchWhere })
      .mockReturnValueOnce({ where: runsWhere });

    const setWhere = vi.fn().mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: setWhere });

    await finalizeBatch("batch-1");

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });
});
