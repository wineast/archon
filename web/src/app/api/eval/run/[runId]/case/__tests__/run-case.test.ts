import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

const insertedResults: Record<string, unknown>[] = [];
const valuesMock = vi.fn((v: Record<string, unknown>) => {
  insertedResults.push(v);
});
const insertMock = vi.fn(() => ({ values: valuesMock }));

let selectRunResult: unknown[] = [{ id: "run-1", agentId: "agent-1", assertionFailConfig: null }];
let selectModelResult: unknown[] = [
  {
    id: "mc-1",
    modelId: "gpt-4",
    systemPrompt: "You are helpful",
    temperature: 0.7,
    agentId: null,
  },
];
let selectJudgeModelResult: unknown[] = [
  {
    id: "jmc-1",
    modelId: "gpt-4-judge",
    systemPrompt: "Judge this",
    temperature: 0.1,
    agentId: null,
  },
];
let selectJudgeConfigResult: unknown[] = [
  {
    id: "jc-1",
    name: "Default",
    dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
  },
];
let selectToolsResult: unknown[] = [];

// Track which table was queried
let fromCallIndex = 0;
const whereSelectMock = vi.fn(() => {
  // 0: evalRuns, 1: modelConfigs, 2: judgeModelConfig, 3: judgeConfig, 4: tools
  const idx = fromCallIndex++;
  const result =
    idx === 0 ? selectRunResult :
    idx === 1 ? selectModelResult :
    idx === 2 ? selectJudgeModelResult :
    idx === 3 ? selectJudgeConfigResult :
    selectToolsResult;
  return {
    limit: vi.fn(() => result),
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(result)),
    [Symbol.iterator]: function* () { yield* (result as unknown[]); },
  };
});
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    insert: () => insertMock(),
    select: () => selectMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  evalRuns: { id: "id" },
  evalRunResults: { runId: "run_id" },
  modelConfigs: { id: "id" },
  judgeConfigs: { id: "id" },
  tools: { enabled: "enabled", deletedAt: "deleted_at" },
  agents: { id: "id", orgId: "org_id" },
  schemas: { id: "id", agentId: "agent_id", parameters: "parameters", deletedAt: "deleted_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNull: (col: unknown) => ({ op: "isNull", col }),
  inArray: (col: unknown, vals: unknown[]) => ({ op: "inArray", col, vals }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ user: { id: "user-1" }, role: "admin", isSuperAdmin: false }),
}));

// Mock AI SDK
const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  gateway: (model: string) => model,
  Output: { object: ({ schema }: { schema: unknown }) => ({ schema }) },
  stepCountIs: (n: number) => ({ type: "stepCount", count: n }),
}));

// Mock assertion runner
const mockRunAllAssertions = vi.fn();
vi.mock("@/lib/eval/assertions", () => ({
  runAllAssertions: (...args: unknown[]) => mockRunAllAssertions(...args),
}));

// Mock template rendering
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

const mockBuildDynamicTools = vi.fn().mockReturnValue({});
vi.mock("@/app/api/chat/tools/build-dynamic-tools", () => ({
  buildDynamicTools: (...args: unknown[]) => mockBuildDynamicTools(...args),
}));

// Mock usage recording
vi.mock("@/lib/usage/record", () => ({
  recordUsage: vi.fn().mockResolvedValue(undefined),
}));

// Mock BYOK resolve
vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn().mockImplementation((modelId: string) => Promise.resolve(modelId)),
}));

vi.mock("@/lib/ai/get-org-id", () => ({
  getOrgIdByAgentId: vi.fn().mockResolvedValue("org-1"),
}));

// Mock judge dimensions
vi.mock("@/lib/eval/judge-dimensions", () => ({
  buildJudgeSchema: vi.fn().mockReturnValue({}),
  toJudgeResult: vi.fn().mockReturnValue({
    scores: { quality: { score: 8, reason: "good" } },
    overallScore: 8,
  }),
}));

const { POST } = await import("../route");

const params = Promise.resolve({ runId: "run-1" });

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/eval/run/run-1/case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  case: {
    id: "case-1",
    name: "Test Case",
    mode: "single",
    turns: [{ id: "t1", role: "user", content: "Hello" }],
    assertions: [{ id: "a1", type: "contains", value: "world" }],
    expectedOutput: "Hello world",
  },
  judgeModelConfigId: "jmc-1",
  judgeConfigId: "jc-1",
  modelConfigId: "mc-1",
};

describe("POST /api/eval/run/[runId]/case", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedResults.length = 0;
    fromCallIndex = 0;
    selectRunResult = [{ id: "run-1", agentId: "agent-1", assertionFailConfig: null }];
    selectModelResult = [
      {
        id: "mc-1",
        modelId: "gpt-4",
        systemPrompt: "You are helpful",
        temperature: 0.7,
        agentId: null,
      },
    ];
    selectJudgeModelResult = [
      {
        id: "jmc-1",
        modelId: "gpt-4-judge",
        systemPrompt: "Judge this",
        temperature: 0.1,
        agentId: null,
      },
    ];
    selectJudgeConfigResult = [
      {
        id: "jc-1",
        name: "Default",
        dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
      },
    ];
    selectToolsResult = [];
  });

  it("returns 404 if run not found", async () => {
    selectRunResult = [];

    const res = await POST(makeRequest(baseBody), { params });
    expect(res.status).toBe(404);
  });

  it("returns 400 if model config not found", async () => {
    selectModelResult = [];

    const res = await POST(makeRequest(baseBody), { params });
    expect(res.status).toBe(400);
  });

  it("returns 400 if judge model config not found", async () => {
    selectJudgeModelResult = [];

    const res = await POST(makeRequest(baseBody), { params });
    expect(res.status).toBe(400);
  });

  it("returns 400 if judge config not found", async () => {
    selectJudgeConfigResult = [];

    const res = await POST(makeRequest(baseBody), { params });
    expect(res.status).toBe(400);
  });

  it("executes a single mode case and returns result with all assertions passed", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Hello world response", usage: { inputTokens: 100, outputTokens: 50 } }) // chat
      .mockResolvedValueOnce({
        output: { quality: { score: 8, reason: "good" } },
        usage: { inputTokens: 300, outputTokens: 50 },
      }); // judge

    mockRunAllAssertions.mockReturnValue([
      {
        assertion: { id: "a1", type: "contains", value: "world" },
        passed: true,
        message: "contains 'world'",
      },
    ]);

    const res = await POST(makeRequest(baseBody), { params });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.result.caseId).toBe("case-1");
    expect(json.result.caseName).toBe("Test Case");
    expect(json.result.mode).toBe("single");
    expect(json.result.allAssertionsPassed).toBe(true);
    expect(json.result.chatResponse).toBe("Hello world response");
    expect(json.result.judgeResult).toBeTruthy();
    expect(json.result.chatMessages).toHaveLength(2);
    expect(json.result.chatMessages[0].role).toBe("user");
    expect(json.result.chatMessages[1].role).toBe("assistant");
  });

  it("skips judge when assertions fail", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "No match", usage: { inputTokens: 80, outputTokens: 30 } }); // chat only

    mockRunAllAssertions.mockReturnValue([
      {
        assertion: { id: "a1", type: "contains", value: "world" },
        passed: false,
        message: "does not contain 'world'",
      },
    ]);

    const res = await POST(makeRequest(baseBody), { params });
    const json = await res.json();

    expect(json.result.allAssertionsPassed).toBe(false);
    expect(json.result.judgeResult).toBeNull();
    // generateText should only be called once (chat), not twice (no judge)
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("saves result to evalRunResults with new fields", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "response", usage: { inputTokens: 50, outputTokens: 20 } });
    mockRunAllAssertions.mockReturnValue([]);

    await POST(makeRequest(baseBody), { params });

    expect(insertedResults.length).toBe(1);
    expect(insertedResults[0]).toMatchObject({
      runId: "run-1",
      caseId: "case-1",
      caseName: "Test Case",
      mode: "single",
    });
    expect(insertedResults[0]).toHaveProperty("turns");
    expect(insertedResults[0]).toHaveProperty("chatMessages");
    expect(insertedResults[0]).toHaveProperty("turnResults");
  });

  it("passes tools and maxSteps to generateText", async () => {
    const fakeTools = { myTool: { execute: vi.fn() } };
    mockBuildDynamicTools.mockReturnValueOnce(fakeTools);
    selectToolsResult = [
      {
        name: "my_tool",
        description: "A tool",
        parameters: [],
        handler: "",
        enabled: true,
      },
    ];

    mockGenerateText.mockResolvedValueOnce({ text: "response", usage: { inputTokens: 50, outputTokens: 20 } });
    mockRunAllAssertions.mockReturnValue([]);

    await POST(makeRequest(baseBody), { params });

    expect(mockBuildDynamicTools).toHaveBeenCalledTimes(1);
    const chatCall = mockGenerateText.mock.calls[0][0];
    expect(chatCall.tools).toBe(fakeTools);
    expect(chatCall.stopWhen).toEqual({ type: "stepCount", count: 5 });
  });

  it("handles generateText error gracefully", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("API timeout"));

    const res = await POST(makeRequest(baseBody), { params });
    const json = await res.json();

    expect(json.result.error).toBe("API timeout");
    expect(json.result.chatResponse).toBe("");
    expect(json.result.allAssertionsPassed).toBe(false);
    expect(json.result.mode).toBe("single");
    // Should still save the error result
    expect(insertedResults.length).toBe(1);
    expect(insertedResults[0]).toMatchObject({
      error: "API timeout",
      mode: "single",
    });
  });

  it("executes injected mode with single LLM call", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Detailed analysis", usage: { inputTokens: 200, outputTokens: 100 } }) // chat
      .mockResolvedValueOnce({ output: { quality: { score: 8, reason: "good" } }, usage: { inputTokens: 300, outputTokens: 50 } }); // judge
    mockRunAllAssertions.mockReturnValue([]);

    const injectedBody = {
      ...baseBody,
      case: {
        id: "case-2",
        name: "Injected Case",
        mode: "injected",
        turns: [
          { id: "t1", role: "user", content: "What products match?" },
          { id: "t2", role: "assistant", content: "Universe, Ocean" },
          { id: "t3", role: "user", content: "Tell me more about Universe" },
        ],
        assertions: [],
        expectedOutput: "",
      },
    };

    const res = await POST(makeRequest(injectedBody), { params });
    const json = await res.json();

    expect(json.result.mode).toBe("injected");
    // 1 chat LLM call + 1 judge call = 2 total
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    // Should have 4 chat messages (3 injected + 1 response)
    expect(json.result.chatMessages).toHaveLength(4);
  });

  it("executes sequential mode with multiple LLM calls", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Products: Universe, Ocean", usage: { inputTokens: 150, outputTokens: 60 } }) // chat turn 1
      .mockResolvedValueOnce({ text: "Max LTV is 75%", usage: { inputTokens: 200, outputTokens: 80 } }) // chat turn 2
      .mockResolvedValueOnce({ output: { quality: { score: 8, reason: "good" } }, usage: { inputTokens: 300, outputTokens: 50 } }); // judge
    mockRunAllAssertions.mockReturnValue([]);

    const sequentialBody = {
      ...baseBody,
      case: {
        id: "case-3",
        name: "Sequential Case",
        mode: "sequential",
        turns: [
          { id: "t1", role: "user", content: "List products" },
          { id: "t2", role: "user", content: "What is max LTV?" },
        ],
        assertions: [],
        expectedOutput: "",
      },
    };

    const res = await POST(makeRequest(sequentialBody), { params });
    const json = await res.json();

    expect(json.result.mode).toBe("sequential");
    // 2 chat LLM calls + 1 judge call = 3 total
    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    // 4 chat messages: user1, assistant1, user2, assistant2
    expect(json.result.chatMessages).toHaveLength(4);
    expect(json.result.chatResponse).toBe("Max LTV is 75%");
  });
});
