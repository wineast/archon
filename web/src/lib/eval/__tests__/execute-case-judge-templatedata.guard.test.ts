/**
 * 缺陷守护：Judge systemPrompt 必须使用 judge agent 自身的 templateData 渲染
 *
 * Cause Anchor: executeCase 为 eval 和 judge 分别调用 gatherTemplateData，
 *   judge systemPrompt 渲染使用 judge 的 templateData
 * Boundary: judgeVersionId/judgeAgentId 为 null 时安全降级
 * Blast Shield: chat systemPrompt 仍使用 eval templateData，两份 templateData 都被 dispose
 *
 * @see .task/DEFECT.md
 * @see .task/FIX_REPORT.md
 * @see .task/VERIFY_REPORT.md
 */
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

// Use tagged objects to distinguish eval vs judge templateData
const evalTemplateData = {
  resolvedVars: {},
  docs: [],
  toolRows: [],
  datasetEntries: {},
  defsMap: {},
  _source: "eval-agent",
};

const judgeTemplateData = {
  resolvedVars: {},
  docs: [],
  toolRows: [],
  datasetEntries: {},
  defsMap: {},
  _source: "judge-agent",
};

const mockGatherTemplateData = vi.fn();
const mockRenderTemplate = vi.fn().mockImplementation((text: string) => Promise.resolve(text));
const mockDisposeTemplateData = vi.fn();

vi.mock("@/lib/template/render", () => ({
  gatherTemplateData: (...args: unknown[]) => mockGatherTemplateData(...args),
  renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
  disposeTemplateData: (...args: unknown[]) => mockDisposeTemplateData(...args),
}));

vi.mock("@/app/api/chat/tools/build-dynamic-tools", () => ({
  buildDynamicTools: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn().mockImplementation((modelId: string) => Promise.resolve(modelId)),
}));

vi.mock("@/lib/eval/judge-dimensions", () => ({
  buildJudgeSchema: vi.fn().mockReturnValue({}),
  toJudgeResult: vi.fn().mockReturnValue({ scores: { quality: { score: 8, reason: "good" } }, overallScore: 8 }),
}));

vi.mock("@/lib/eval/judge-prompt", () => ({
  renderJudgePrompt: vi.fn().mockResolvedValue("rendered judge prompt"),
}));

const { executeCase } = await import("../execute-case");

// ── Fixtures ──

const makeRun = (overrides: Record<string, unknown> = {}) => ({
  id: "run-1",
  agentId: "agent-1",
  chatVersionId: "version-1",
  chatModel: "gpt-4",
  chatSystemPrompt: "You are helpful. {{ dataset_a }}",
  chatTemperature: 0.7,
  judgeAgentId: "judge-1",
  judgeVersionId: "judge-version-1",
  judgeModelConfigSnapshot: {
    modelId: "gpt-4-judge",
    systemPrompt: "Judge this. {{ scoring_criteria }}",
    temperature: 0.1,
  },
  judgeConfigSnapshot: {
    name: "Default",
    dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
  },
  assertionFailConfig: null,
  filterTags: [],
  templateVars: {},
  toolNames: [],
  totalCases: 1,
  passedAssertions: 0,
  averageScore: null,
  isBaseline: false,
  status: "running" as const,
  completedCases: 0,
  concurrency: 3,
  error: null,
  batchId: null,
  runIndex: 0,
  createdAt: new Date(),
  ...overrides,
});

const baseCaseWithJudge = {
  id: "case-1",
  key: "test",
  name: "Test Case",
  mode: "single" as const,
  turns: [{ id: "t1", role: "user" as const, content: "Hello" }],
  assertions: [],
  expectedOutput: "Hello world",
};

describe("Guard: Judge systemPrompt 使用 judge agent 自身的 templateData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return tagged templateData objects to distinguish eval vs judge
    mockGatherTemplateData
      .mockResolvedValueOnce(evalTemplateData)
      .mockResolvedValueOnce(judgeTemplateData);
    mockRunAllAssertions.mockReturnValue([]);
    mockGenerateText
      .mockResolvedValueOnce({ text: "chat response", usage: { inputTokens: 50, outputTokens: 20 } })
      .mockResolvedValueOnce({ output: { quality: { score: 8, reason: "good" } }, usage: { inputTokens: 30, outputTokens: 10 } });
  });

  describe("Cause Anchor: gatherTemplateData 分别为 eval 和 judge 调用", () => {
    it("gatherTemplateData 被调用两次：eval agent + judge agent", async () => {
      await executeCase({
        run: makeRun(),
        evalCase: baseCaseWithJudge,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(mockGatherTemplateData).toHaveBeenCalledTimes(2);
      expect(mockGatherTemplateData).toHaveBeenNthCalledWith(1, "agent-1", "version-1");
      expect(mockGatherTemplateData).toHaveBeenNthCalledWith(2, "judge-1", "judge-version-1");
    });

    it("renderTemplate 渲染 judge systemPrompt 时接收 judge templateData", async () => {
      await executeCase({
        run: makeRun(),
        evalCase: baseCaseWithJudge,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      // renderTemplate is called twice: once for chatSystemPrompt, once for judgeSystemPrompt
      const renderCalls = mockRenderTemplate.mock.calls;
      expect(renderCalls.length).toBe(2);

      // First call: chat systemPrompt with eval templateData
      expect(renderCalls[0][0]).toBe("You are helpful. {{ dataset_a }}");
      expect(renderCalls[0][1]).toBe(evalTemplateData);

      // Second call: judge systemPrompt with judge templateData
      expect(renderCalls[1][0]).toBe("Judge this. {{ scoring_criteria }}");
      expect(renderCalls[1][1]).toBe(judgeTemplateData);
    });
  });

  describe("Boundary: null/undefined 安全降级", () => {
    it("judgeVersionId=null 时 gatherTemplateData 收到 undefined", async () => {
      mockGatherTemplateData.mockReset();
      mockGatherTemplateData.mockResolvedValue({ resolvedVars: {}, docs: [], toolRows: [], datasetEntries: {}, defsMap: {} });

      await executeCase({
        run: makeRun({ judgeVersionId: null }),
        evalCase: baseCaseWithJudge,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(mockGatherTemplateData).toHaveBeenNthCalledWith(2, "judge-1", undefined);
    });

    it("judgeAgentId=null 时 gatherTemplateData 收到 undefined", async () => {
      mockGatherTemplateData.mockReset();
      mockGatherTemplateData.mockResolvedValue({ resolvedVars: {}, docs: [], toolRows: [], datasetEntries: {}, defsMap: {} });

      await executeCase({
        run: makeRun({ judgeAgentId: null }),
        evalCase: baseCaseWithJudge,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(mockGatherTemplateData).toHaveBeenNthCalledWith(2, undefined, "judge-version-1");
    });

    it("sequential 模式 per-turn judge 同样使用 judge templateData", async () => {
      const sequentialCase = {
        ...baseCaseWithJudge,
        mode: "sequential" as const,
        turns: [
          { id: "t1", role: "user" as const, content: "Hello", judge: true, expectedOutput: "Hi" },
        ],
      };

      mockGenerateText.mockReset();
      mockGenerateText
        .mockResolvedValueOnce({ text: "Hi there", usage: { inputTokens: 50, outputTokens: 20 } })
        .mockResolvedValueOnce({ output: { quality: { score: 8, reason: "good" } }, usage: { inputTokens: 30, outputTokens: 10 } })
        .mockResolvedValueOnce({ output: { quality: { score: 9, reason: "great" } }, usage: { inputTokens: 30, outputTokens: 10 } });

      await executeCase({
        run: makeRun(),
        evalCase: sequentialCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      // renderTemplate calls: 1st for chat systemPrompt, 2nd+ for judge systemPrompts (per-turn + case-level)
      const judgeRenderCalls = mockRenderTemplate.mock.calls.filter(
        (call) => call[0] === "Judge this. {{ scoring_criteria }}"
      );
      for (const call of judgeRenderCalls) {
        expect(call[1]).toBe(judgeTemplateData);
      }
    });
  });

  describe("Blast Shield: chat templateData 未被误改 + 资源释放", () => {
    it("chat systemPrompt 渲染使用 eval agent 的 templateData", async () => {
      await executeCase({
        run: makeRun(),
        evalCase: baseCaseWithJudge,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      const chatRenderCall = mockRenderTemplate.mock.calls.find(
        (call) => call[0] === "You are helpful. {{ dataset_a }}"
      );
      expect(chatRenderCall).toBeDefined();
      expect(chatRenderCall![1]).toBe(evalTemplateData);
    });

    it("finally 中 disposeTemplateData 对两份 templateData 都调用", async () => {
      await executeCase({
        run: makeRun(),
        evalCase: baseCaseWithJudge,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(mockDisposeTemplateData).toHaveBeenCalledTimes(2);
      expect(mockDisposeTemplateData).toHaveBeenCalledWith(evalTemplateData);
      expect(mockDisposeTemplateData).toHaveBeenCalledWith(judgeTemplateData);
    });

    it("executeCase 异常时两份 templateData 仍被 dispose", async () => {
      mockGenerateText.mockReset();
      mockGenerateText.mockRejectedValueOnce(new Error("LLM error"));

      const { result } = await executeCase({
        run: makeRun(),
        evalCase: baseCaseWithJudge,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(result.error).toBe("LLM error");
      expect(mockDisposeTemplateData).toHaveBeenCalledTimes(2);
      expect(mockDisposeTemplateData).toHaveBeenCalledWith(evalTemplateData);
      expect(mockDisposeTemplateData).toHaveBeenCalledWith(judgeTemplateData);
    });
  });
});
