import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  tools: { enabled: "enabled", deletedAt: "deleted_at", versionId: "version_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNull: (col: unknown) => ({ op: "isNull", col }),
}));

const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  gateway: (model: string) => model,
  Output: { object: ({ schema }: { schema: unknown }) => ({ schema }) },
  stepCountIs: (n: number) => ({ type: "stepCount", count: n }),
}));

const mockRunAllAssertions = vi.fn();
vi.mock("@/lib/eval/assertions", () => ({
  runAllAssertions: (...args: unknown[]) => mockRunAllAssertions(...args),
}));

vi.mock("@/lib/template/render", () => ({
  gatherTemplateData: vi.fn().mockResolvedValue({
    resolvedVars: {},
    docs: [],
    toolRows: [],
    datasetEntries: {},
  }),
  renderTemplate: vi.fn().mockImplementation((text: string) =>
    Promise.resolve(text)
  ),
  disposeTemplateData: vi.fn(),
}));

vi.mock("@/app/api/chat/tools/build-dynamic-tools", () => ({
  buildDynamicTools: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn().mockImplementation((modelId: string) => Promise.resolve(modelId)),
}));

vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockResolvedValue("version-1"),
}));

vi.mock("@/lib/eval/judge-dimensions", () => ({
  buildJudgeSchema: vi.fn().mockReturnValue({}),
  toJudgeResult: vi.fn().mockReturnValue({
    scores: { quality: { score: 8, reason: "good" } },
    overallScore: 8,
  }),
}));

const { executeCase, extractToolCalls, turnToMessages } = await import("../execute-case");

const baseRun = {
  id: "run-1",
  agentId: "agent-1",
  chatModel: "gpt-4",
  chatSystemPrompt: "You are helpful",
  chatTemperature: 0.7,
  judgeModelConfigSnapshot: {
    modelId: "gpt-4-judge",
    systemPrompt: "Judge this",
    temperature: 0.1,
  },
  judgeConfigSnapshot: {
    name: "Default",
    dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
  },
  assertionFailConfig: null,
  judgeAgentId: "judge-1",
  filterTags: [],
  totalCases: 1,
  passedAssertions: 0,
  averageScore: null,
  isBaseline: false,
  status: "running" as const,
  completedCases: 0,
  concurrency: 3,
  error: null,
  createdAt: new Date(),
};

const baseCase = {
  id: "case-1",
  key: "test",
  name: "Test Case",
  mode: "single" as const,
  turns: [{ id: "t1", role: "user" as const, content: "Hello" }],
  assertions: [{ id: "a1", type: "contains" as const, value: "world" }],
  expectedOutput: "Hello world",
};

describe("executeCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes a single mode case and returns result", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Hello world response", usage: { inputTokens: 100, outputTokens: 50 } })
      .mockResolvedValueOnce({ output: { quality: { score: 8, reason: "good" } }, usage: { inputTokens: 300, outputTokens: 50 } });
    mockRunAllAssertions.mockReturnValue([
      { assertion: { id: "a1", type: "contains", value: "world" }, passed: true, message: "ok" },
    ]);

    const { result, chatUsage, judgeUsage } = await executeCase({
      run: baseRun,
      evalCase: baseCase,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    expect(result.caseId).toBe("case-1");
    expect(result.chatResponse).toBe("Hello world response");
    expect(result.allAssertionsPassed).toBe(true);
    expect(result.judgeResult).toBeTruthy();
    expect(chatUsage.inputTokens).toBe(100);
    expect(judgeUsage.inputTokens).toBe(300);
  });

  it("handles errors gracefully", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("API timeout"));

    const { result } = await executeCase({
      run: baseRun,
      evalCase: baseCase,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    expect(result.error).toBe("API timeout");
    expect(result.chatResponse).toBe("");
    expect(result.allAssertionsPassed).toBe(false);
  });

  it("skips judge when assertions fail and judgeOnFail is false", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "No match", usage: { inputTokens: 80, outputTokens: 30 } });
    mockRunAllAssertions.mockReturnValue([
      { assertion: { id: "a1", type: "contains", value: "world" }, passed: false, message: "fail" },
    ]);

    const { result } = await executeCase({
      run: baseRun,
      evalCase: baseCase,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    expect(result.allAssertionsPassed).toBe(false);
    expect(result.judgeResult).toBeNull();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("skips judge when no expectedOutput", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "Some response",
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    mockRunAllAssertions.mockReturnValue([
      { assertion: { id: "a1", type: "contains", value: "world" }, passed: true, message: "ok" },
    ]);

    const caseNoExpected = { ...baseCase, expectedOutput: "" };

    const { result } = await executeCase({
      run: baseRun,
      evalCase: caseNoExpected,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    expect(result.allAssertionsPassed).toBe(true);
    expect(result.judgeResult).toBeNull();
    // Only 1 call (chat), no judge call
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("skips judge when no expectedOutput even with judgeOnFail", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "No match",
      usage: { inputTokens: 80, outputTokens: 30 },
    });
    mockRunAllAssertions.mockReturnValue([
      { assertion: { id: "a1", type: "contains", value: "world" }, passed: false, message: "fail" },
    ]);

    const runWithJudgeOnFail = {
      ...baseRun,
      assertionFailConfig: { judgeOnFail: true },
    };
    const caseNoExpected = { ...baseCase, expectedOutput: "" };

    const { result } = await executeCase({
      run: runWithJudgeOnFail,
      evalCase: caseNoExpected,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    expect(result.allAssertionsPassed).toBe(false);
    expect(result.judgeResult).toBeNull();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("runs judge when assertions fail and judgeOnFail is true", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "No match", usage: { inputTokens: 80, outputTokens: 30 } })
      .mockResolvedValueOnce({ output: { quality: { score: 3, reason: "bad" } }, usage: { inputTokens: 200, outputTokens: 40 } });
    mockRunAllAssertions.mockReturnValue([
      { assertion: { id: "a1", type: "contains", value: "world" }, passed: false, message: "fail" },
    ]);

    const runWithJudgeOnFail = {
      ...baseRun,
      assertionFailConfig: { judgeOnFail: true },
    };

    const { result } = await executeCase({
      run: runWithJudgeOnFail,
      evalCase: baseCase,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    expect(result.allAssertionsPassed).toBe(false);
    expect(result.judgeResult).toBeTruthy();
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("sequential mode: skips per-turn judge when no expectedOutput", async () => {
    // Two user turns, assistant responds to each
    mockGenerateText
      .mockResolvedValueOnce({ text: "Response 1", usage: { inputTokens: 50, outputTokens: 20 } })
      .mockResolvedValueOnce({ text: "Response 2", usage: { inputTokens: 60, outputTokens: 25 } });
    mockRunAllAssertions
      .mockReturnValueOnce([]) // per-turn assertions for turn 0
      .mockReturnValue([       // case-level assertions
        { assertion: { id: "a1", type: "contains", value: "Response" }, passed: true, message: "ok" },
      ]);

    const sequentialCase = {
      ...baseCase,
      mode: "sequential" as const,
      expectedOutput: "",  // no case-level expected output
      turns: [
        { id: "t1", role: "user" as const, content: "Hello", judge: true, expectedOutput: "" },
        { id: "t2", role: "user" as const, content: "Follow up", judge: true },
      ],
    };

    const { result } = await executeCase({
      run: baseRun,
      evalCase: sequentialCase,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    // 2 chat calls, 0 judge calls
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(result.judgeResult).toBeNull();
    // No per-turn judge results
    const turnJudges = result.turnResults.filter((tr) => tr.judgeResult);
    expect(turnJudges).toHaveLength(0);
  });

  it("sequential mode: runs per-turn judge when turn has expectedOutput", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Response 1", usage: { inputTokens: 50, outputTokens: 20 } })
      .mockResolvedValueOnce({ output: { quality: { score: 8, reason: "good" } }, usage: { inputTokens: 200, outputTokens: 40 } })
      .mockResolvedValueOnce({ text: "Response 2", usage: { inputTokens: 60, outputTokens: 25 } });
    mockRunAllAssertions
      .mockReturnValueOnce([]) // per-turn assertions for turn 0
      .mockReturnValue([       // case-level assertions
        { assertion: { id: "a1", type: "contains", value: "Response" }, passed: true, message: "ok" },
      ]);

    const sequentialCase = {
      ...baseCase,
      mode: "sequential" as const,
      expectedOutput: "",  // no case-level expected output
      turns: [
        { id: "t1", role: "user" as const, content: "Hello", judge: true, expectedOutput: "Expected response 1" },
        { id: "t2", role: "user" as const, content: "Follow up", judge: true },  // no turn expectedOutput, no case expectedOutput → skip
      ],
    };

    const { result } = await executeCase({
      run: baseRun,
      evalCase: sequentialCase,
      templateVars: {},
      toolNames: [],
      orgId: "org-1",
    });

    // 2 chat calls + 1 judge call (only for turn 0 which has expectedOutput)
    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    expect(result.judgeResult).toBeNull(); // no case-level judge (no case expectedOutput)
    const turnJudges = result.turnResults.filter((tr) => tr.judgeResult);
    expect(turnJudges).toHaveLength(1);
  });
});

describe("extractToolCalls", () => {
  it("returns empty array when no steps", () => {
    expect(extractToolCalls(undefined)).toEqual([]);
    expect(extractToolCalls([])).toEqual([]);
  });

  it("extracts tool calls from steps", () => {
    const steps = [{
      toolCalls: [{ toolCallId: "tc1", toolName: "search", input: { q: "hello" } }],
      toolResults: [{ toolCallId: "tc1", output: "result1" }],
    }];

    const result = extractToolCalls(steps as never);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      toolName: "search",
      args: { q: "hello" },
      result: "result1",
    });
  });
});

describe("turnToMessages", () => {
  it("converts user turn to user message", () => {
    const msgs = turnToMessages({ id: "t1", role: "user", content: "hello" });
    expect(msgs).toEqual([{ role: "user", content: "hello" }]);
  });

  it("converts simple assistant turn", () => {
    const msgs = turnToMessages({ id: "t1", role: "assistant", content: "response" });
    expect(msgs).toEqual([{ role: "assistant", content: "response" }]);
  });

  it("converts assistant turn with tool calls", () => {
    const msgs = turnToMessages({
      id: "t1",
      role: "assistant",
      content: "Let me check",
      toolCalls: [{ name: "search", args: { q: "test" }, result: "found" }],
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("assistant");
    expect(msgs[1].role).toBe("tool");
  });
});
