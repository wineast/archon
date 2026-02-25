import { describe, it, expect, vi, beforeEach } from "vitest";
import { InngestTestEngine } from "@inngest/test";
import { Inngest } from "inngest";

// ── Dependency mocks ──

// DB: only used by load-config step (select concurrency)
const mockDbSelectWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockDbSelectWhere,
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id", concurrency: "concurrency" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// isRunCancelled / finalizeRun — called inside step handlers
const mockIsRunCancelled = vi.fn();
const mockFinalizeRun = vi.fn();
vi.mock("@/lib/eval/execute-run", () => ({
  isRunCancelled: mockIsRunCancelled,
  finalizeRun: mockFinalizeRun,
}));

const mockGetOrgId = vi.fn();
vi.mock("@/lib/ai/get-org-id", () => ({
  getOrgIdByAgentId: mockGetOrgId,
}));

// evalCaseWorker — must be a valid InngestFunction for step.invoke validation
const testClient = new Inngest({ id: "test" });
vi.mock("../eval-case-worker", () => ({
  evalCaseWorker: testClient.createFunction(
    { id: "eval-case-worker" },
    { event: "eval/case.execute" },
    async () => ({})
  ),
}));

const { evalOrchestrator } = await import("../eval-orchestrator");

// ── Helpers ──

function makeCaseInvokeMocks(caseIds: string[]) {
  return caseIds.map((id) => ({
    id: `case-${id}`,
    handler: () => ({ status: "completed", caseId: id }),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEvents(caseIds: string[]): [any, ...any[]] {
  return [
    {
      name: "eval/run.created",
      data: {
        runId: "run-1",
        agentId: "agent-1",
        caseIds,
        userId: "user-1",
      },
    },
  ];
}

describe("eval-orchestrator", () => {
  let t: InstanceType<typeof InngestTestEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    t = new InngestTestEngine({ function: evalOrchestrator });

    // Default dependency mocks
    mockDbSelectWhere.mockResolvedValue([{ concurrency: 2 }]);
    mockGetOrgId.mockResolvedValue("org-1");
    mockIsRunCancelled.mockResolvedValue(false);
    mockFinalizeRun.mockResolvedValue(undefined);
  });

  it("A1: 正常分批执行 (3 cases, concurrency=2)", async () => {
    const caseIds = ["c1", "c2", "c3"];

    const { result, ctx, error } = await t.execute({
      events: makeEvents(caseIds),
      steps: makeCaseInvokeMocks(caseIds),
    });

    expect(error).toBeUndefined();

    // load-config called once
    expect(ctx.step.run).toHaveBeenCalledWith(
      "load-config",
      expect.any(Function)
    );
    // cancel checks: 2 batches ([c1,c2], [c3]) → 2 checks
    expect(ctx.step.run).toHaveBeenCalledWith(
      "check-cancel-0",
      expect.any(Function)
    );
    expect(ctx.step.run).toHaveBeenCalledWith(
      "check-cancel-1",
      expect.any(Function)
    );
    // 3 case invocations
    expect(ctx.step.invoke).toHaveBeenCalledTimes(3);
    // finalize called
    expect(ctx.step.run).toHaveBeenCalledWith(
      "finalize",
      expect.any(Function)
    );
    // correct return value
    expect(result).toEqual({ status: "done", runId: "run-1" });
  });

  it("A2: 第二批前检测到取消 (4 cases, concurrency=2)", async () => {
    const caseIds = ["c1", "c2", "c3", "c4"];
    // First check → not cancelled, second check → cancelled
    mockIsRunCancelled
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const { result, ctx, error } = await t.execute({
      events: makeEvents(caseIds),
      // Only need mocks for batch 1 cases
      steps: makeCaseInvokeMocks(["c1", "c2"]),
    });

    expect(error).toBeUndefined();

    // batch 1 (c1, c2) executed
    expect(ctx.step.invoke).toHaveBeenCalledTimes(2);
    // batch 2 (c3, c4) NOT executed
    expect(ctx.step.invoke).not.toHaveBeenCalledWith(
      "case-c3",
      expect.anything()
    );
    expect(ctx.step.invoke).not.toHaveBeenCalledWith(
      "case-c4",
      expect.anything()
    );
    // finalize still called (outside the loop)
    expect(ctx.step.run).toHaveBeenCalledWith(
      "finalize",
      expect.any(Function)
    );
    expect(result).toEqual({ status: "done", runId: "run-1" });
  });

  it("A3: 单个 case (1 caseId, concurrency=3)", async () => {
    const caseIds = ["c1"];
    mockDbSelectWhere.mockResolvedValue([{ concurrency: 3 }]);

    const { result, ctx, error } = await t.execute({
      events: makeEvents(caseIds),
      steps: makeCaseInvokeMocks(caseIds),
    });

    expect(error).toBeUndefined();

    // 1 batch → 1 cancel check only
    expect(ctx.step.run).toHaveBeenCalledWith(
      "check-cancel-0",
      expect.any(Function)
    );
    expect(ctx.step.run).not.toHaveBeenCalledWith(
      "check-cancel-1",
      expect.any(Function)
    );
    // 1 invoke
    expect(ctx.step.invoke).toHaveBeenCalledTimes(1);
    // finalize
    expect(ctx.step.run).toHaveBeenCalledWith(
      "finalize",
      expect.any(Function)
    );
    expect(result).toEqual({ status: "done", runId: "run-1" });
  });

  it("A4: Run 不存在 — load-config 抛错", async () => {
    mockDbSelectWhere.mockResolvedValue([]); // no run found

    const { error } = await t.execute({
      events: makeEvents(["c1"]),
    });

    expect(error).toBeDefined();
    expect((error as { message: string }).message).toContain(
      "Run run-1 not found"
    );
  });
});
