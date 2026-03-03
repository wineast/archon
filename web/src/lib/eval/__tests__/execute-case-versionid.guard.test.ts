/**
 * 缺陷守护：Eval run 的所有 case 必须使用 run 创建时快照的 versionId，不可实时查询
 *
 * Cause Anchor: executeCase 不再 import/调用 resolveEditingVersionId，
 *   gatherTemplateData 和 tools 查询使用 run.chatVersionId
 * Boundary: chatVersionId = null 时安全降级（旧 run 兼容）
 * Blast Shield: executeCase 使用快照 versionId 后三种模式仍正常工作
 *
 * @see .task/DEFECT.md
 * @see .task/FIX_REPORT.md
 * @see .task/VERIFY_REPORT.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Mocks ──

const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

vi.mock("@/db", () => ({
  db: {
    select: () => mockDbSelect(),
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

vi.mock("@/lib/eval/assertions", () => ({
  runAllAssertions: vi.fn().mockReturnValue([]),
}));

const mockGatherTemplateData = vi.fn().mockResolvedValue({
  resolvedVars: {},
  docs: [],
  toolRows: [],
  datasetEntries: {},
  defsMap: {},
});

vi.mock("@/lib/template/render", () => ({
  gatherTemplateData: (...args: unknown[]) => mockGatherTemplateData(...args),
  renderTemplate: vi.fn().mockImplementation((text: string) => Promise.resolve(text)),
  disposeTemplateData: vi.fn(),
}));

vi.mock("@/app/api/chat/tools/build-dynamic-tools", () => ({
  buildDynamicTools: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn().mockImplementation((modelId: string) => Promise.resolve(modelId)),
}));

vi.mock("@/lib/eval/judge-dimensions", () => ({
  buildJudgeSchema: vi.fn().mockReturnValue({}),
  toJudgeResult: vi.fn().mockReturnValue({ scores: {}, overallScore: 0 }),
}));

vi.mock("@/lib/eval/judge-prompt", () => ({
  renderJudgePrompt: vi.fn().mockResolvedValue("judge prompt"),
}));

const { executeCase } = await import("../execute-case");

const makeRun = (overrides: Record<string, unknown> = {}) => ({
  id: "run-1",
  agentId: "agent-1",
  chatVersionId: "snapshot-version-id",
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
    dimensions: [],
  },
  assertionFailConfig: null,
  judgeAgentId: "judge-1",
  judgeVersionId: "judge-version-1",
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

const baseCase = {
  id: "case-1",
  key: "test",
  name: "Test Case",
  mode: "single" as const,
  turns: [{ id: "t1", role: "user" as const, content: "Hello" }],
  assertions: [],
  expectedOutput: "",
};

describe("Guard: Eval run case 执行使用快照 versionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockResolvedValue({
      text: "response",
      usage: { inputTokens: 50, outputTokens: 20 },
    });
  });

  describe("Cause Anchor: executeCase 不依赖 resolveEditingVersionId", () => {
    it("execute-case.ts 不 import resolveEditingVersionId", () => {
      const source = readFileSync(
        resolve(__dirname, "../execute-case.ts"),
        "utf-8"
      );
      expect(source).not.toContain("resolveEditingVersionId");
    });

    it("gatherTemplateData 接收 run.chatVersionId 而非实时查询", async () => {
      await executeCase({
        run: makeRun({ chatVersionId: "snapshot-v1" }),
        evalCase: baseCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(mockGatherTemplateData).toHaveBeenCalledWith(
        "agent-1",
        "snapshot-v1"
      );
    });

    it("不同 run 使用各自快照的 chatVersionId", async () => {
      await executeCase({
        run: makeRun({ chatVersionId: "version-A" }),
        evalCase: baseCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      await executeCase({
        run: makeRun({ chatVersionId: "version-B" }),
        evalCase: baseCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      // Each executeCase calls gatherTemplateData twice: eval agent + judge agent
      // Call 1: eval agent (version-A), Call 2: judge agent, Call 3: eval agent (version-B), Call 4: judge agent
      expect(mockGatherTemplateData).toHaveBeenNthCalledWith(
        1,
        "agent-1",
        "version-A"
      );
      expect(mockGatherTemplateData).toHaveBeenNthCalledWith(
        3,
        "agent-1",
        "version-B"
      );
    });
  });

  describe("Boundary: chatVersionId 为 null 时安全降级", () => {
    it("chatVersionId = null 时 gatherTemplateData 收到 undefined", async () => {
      await executeCase({
        run: makeRun({ chatVersionId: null }),
        evalCase: baseCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(mockGatherTemplateData).toHaveBeenCalledWith(
        "agent-1",
        undefined
      );
    });

    it("chatVersionId = null 时不查询 tools（返回空工具集）", async () => {
      await executeCase({
        run: makeRun({ chatVersionId: null }),
        evalCase: baseCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      // db.select 不应被调用（tools 查询被跳过）
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it("chatVersionId = null 时不报错，正常返回结果", async () => {
      const { result } = await executeCase({
        run: makeRun({ chatVersionId: null }),
        evalCase: baseCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(result.error).toBeUndefined();
      expect(result.caseId).toBe("case-1");
    });
  });

  describe("Blast Shield: 快照 versionId 下三种模式正常工作", () => {
    it("single 模式正常执行", async () => {
      const { result } = await executeCase({
        run: makeRun(),
        evalCase: baseCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(result.mode).toBe("single");
      expect(result.error).toBeUndefined();
    });

    it("injected 模式正常执行", async () => {
      const injectedCase = {
        ...baseCase,
        mode: "injected" as const,
        turns: [
          { id: "t1", role: "user" as const, content: "Hello" },
          { id: "t2", role: "assistant" as const, content: "Hi" },
          { id: "t3", role: "user" as const, content: "More" },
        ],
      };

      const { result } = await executeCase({
        run: makeRun(),
        evalCase: injectedCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(result.mode).toBe("injected");
      expect(result.error).toBeUndefined();
    });

    it("sequential 模式正常执行", async () => {
      const sequentialCase = {
        ...baseCase,
        mode: "sequential" as const,
        turns: [
          { id: "t1", role: "user" as const, content: "Hello" },
          { id: "t2", role: "user" as const, content: "Follow up" },
        ],
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: "Response 1", usage: { inputTokens: 50, outputTokens: 20 } })
        .mockResolvedValueOnce({ text: "Response 2", usage: { inputTokens: 60, outputTokens: 25 } });

      const { result } = await executeCase({
        run: makeRun(),
        evalCase: sequentialCase,
        templateVars: {},
        toolNames: [],
        orgId: "org-1",
      });

      expect(result.mode).toBe("sequential");
      expect(result.error).toBeUndefined();
    });
  });
});
