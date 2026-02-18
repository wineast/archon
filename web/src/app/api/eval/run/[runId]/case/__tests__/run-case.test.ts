import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

const insertedResults: Record<string, unknown>[] = [];
const valuesMock = vi.fn((v: Record<string, unknown>) => {
  insertedResults.push(v);
});
const insertMock = vi.fn(() => ({ values: valuesMock }));

let selectRunResult: unknown[] = [{ id: "run-1" }];
let selectModelResult: unknown[] = [
  {
    id: "mc-1",
    modelId: "gpt-4",
    systemPrompt: "You are helpful",
    temperature: 0.7,
    agentId: null,
  },
];
let selectToolsResult: unknown[] = [];

// Track which table was queried
let fromCallIndex = 0;
const whereSelectMock = vi.fn(() => {
  // First call => evalRuns, second call => modelConfigs, third call => tools
  const idx = fromCallIndex++;
  if (idx === 0) return selectRunResult;
  if (idx === 1) return selectModelResult;
  return selectToolsResult;
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
  tools: { enabled: "enabled" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
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
}));

// Mock tool-related modules
vi.mock("@/tool-impls", () => ({}));

const mockBuildDynamicTools = vi.fn().mockReturnValue({});
vi.mock("@/app/api/chat/tools/build-dynamic-tools", () => ({
  buildDynamicTools: (...args: unknown[]) => mockBuildDynamicTools(...args),
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
    input: "Hello",
    assertions: [{ id: "a1", type: "contains", value: "world" }],
    expectedOutput: "Hello world",
  },
  judgeConfig: {
    systemPrompt: "Judge this",
    model: "gpt-4",
    temperature: 0.1,
    dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
  },
  modelConfigId: "mc-1",
};

describe("POST /api/eval/run/[runId]/case", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedResults.length = 0;
    fromCallIndex = 0;
    selectRunResult = [{ id: "run-1" }];
    selectModelResult = [
      {
        id: "mc-1",
        modelId: "gpt-4",
        systemPrompt: "You are helpful",
        temperature: 0.7,
        agentId: null,
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

  it("executes a case and returns result with all assertions passed", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Hello world response" }) // chat
      .mockResolvedValueOnce({
        output: { quality: { score: 8, reason: "good" } },
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
    expect(json.result.allAssertionsPassed).toBe(true);
    expect(json.result.chatResponse).toBe("Hello world response");
    expect(json.result.judgeResult).toBeTruthy();
  });

  it("skips judge when assertions fail", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "No match" }); // chat only

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

  it("saves result to evalRunResults", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "response" });
    mockRunAllAssertions.mockReturnValue([]);

    await POST(makeRequest(baseBody), { params });

    expect(insertedResults.length).toBe(1);
    expect(insertedResults[0]).toMatchObject({
      runId: "run-1",
      caseId: "case-1",
      caseName: "Test Case",
    });
  });

  it("passes tools and maxSteps to generateText", async () => {
    const fakeTools = { myTool: { execute: vi.fn() } };
    mockBuildDynamicTools.mockReturnValueOnce(fakeTools);
    selectToolsResult = [
      {
        name: "my_tool",
        description: "A tool",
        parameters: [],
        output: "",
        handler: "",
        enabled: true,
      },
    ];

    mockGenerateText.mockResolvedValueOnce({ text: "response" });
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
    // Should still save the error result
    expect(insertedResults.length).toBe(1);
    expect(insertedResults[0]).toMatchObject({
      error: "API timeout",
    });
  });
});
