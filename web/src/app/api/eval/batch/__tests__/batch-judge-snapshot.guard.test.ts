/**
 * 缺陷守护：Batch 模式 judgeConfigSnapshot 必须包含 promptTemplate / turnPromptTemplate
 *
 * 守护目标：batch 创建的 eval run 快照不再丢失自定义 judge prompt 模板字段
 * 故障机制：batch/route.ts 手动构造快照时字段遗漏（仅复制 name + dimensions）
 *
 * @see .task/DEFECT.md
 * @see .task/FIX_REPORT.md
 * @see .task/VERIFY_REPORT.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──

const insertedValues: Record<string, unknown>[] = [];
let insertCallIndex = 0;
const returningResults = [
  [{ id: "batch-1", chatModel: "gpt-4", status: "running" }],
  [{ id: "run-1", chatModel: "gpt-4", status: "pending" }],
];
const returningMock = vi.fn(() => returningResults[insertCallIndex++]);
const valuesMock = vi.fn((v: Record<string, unknown>) => {
  insertedValues.push(v);
  return { returning: returningMock };
});
const insertMock = vi.fn(() => ({ values: valuesMock }));

let selectCallIndex = 0;
let selectResults: unknown[][];

function resetSelectResults(judgeConfigOverride?: Record<string, unknown>) {
  const baseJudgeConfig = {
    id: "jc-1",
    name: "Default",
    dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
    promptTemplate: null,
    turnPromptTemplate: null,
    ...judgeConfigOverride,
  };
  selectResults = [
    [],
    [{ id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null }],
    [{ id: "jmc-1", modelId: "gpt-4-judge", systemPrompt: "Judge this", temperature: 0.1, agentId: null }],
    [baseJudgeConfig],
  ];
}

const limitMock = vi.fn(() => selectResults[selectCallIndex++]);
const whereSelectMock = vi.fn(() => {
  const idx = selectCallIndex;
  if (idx === 0) return { limit: limitMock };
  return selectResults[selectCallIndex++];
});
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => {
  const txProxy = {
    insert: () => insertMock(),
    select: () => selectMock(),
  };
  return {
    db: {
      insert: () => insertMock(),
      select: () => selectMock(),
      transaction: async (fn: (tx: typeof txProxy) => Promise<unknown>) => fn(txProxy),
    },
  };
});

vi.mock("@/db/schema", () => ({
  evalBatches: { id: "id", agentId: "agent_id", status: "status" },
  evalRuns: { id: "id", agentId: "agent_id", status: "status" },
  modelConfigs: { id: "id", versionId: "version_id", isActive: "is_active" },
  judgeConfigs: { id: "id", versionId: "version_id", isActive: "is_active" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNull: (col: unknown) => ({ op: "isNull", col }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ agentId: "agent-1", user: { id: "user-1" } }),
}));

vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockImplementation((agentId: string) =>
    Promise.resolve(agentId === "agent-1" ? "version-1" : "judge-version-1")
  ),
}));

vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ["evt-1"] }) },
}));

const { POST } = await import("../route");

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/eval/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  agentId: "agent-1",
  judgeAgentId: "judge-agent-1",
  totalCases: 1,
  cases: [{ id: "c1", key: "test", name: "Test", mode: "single", turns: [], assertions: [], expectedOutput: "" }],
  repeatCount: 1,
};

describe("Guard: batch judgeConfigSnapshot 必须包含 promptTemplate + turnPromptTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    insertCallIndex = 0;
    selectCallIndex = 0;
  });

  describe("Cause Anchor: 快照构造必须透传全部 JudgeConfigData 字段", () => {
    it("batch 级快照包含 promptTemplate 和 turnPromptTemplate", async () => {
      resetSelectResults({
        promptTemplate: "Custom: {{ user_input }}",
        turnPromptTemplate: "Turn: {{ conversation }}",
      });

      await POST(makeRequest(baseBody));

      const batchRecord = insertedValues[0] as { judgeConfigSnapshot: Record<string, unknown> };
      expect(batchRecord.judgeConfigSnapshot).toHaveProperty("promptTemplate", "Custom: {{ user_input }}");
      expect(batchRecord.judgeConfigSnapshot).toHaveProperty("turnPromptTemplate", "Turn: {{ conversation }}");
    });

    it("per-run 级快照包含 promptTemplate 和 turnPromptTemplate", async () => {
      resetSelectResults({
        promptTemplate: "Custom: {{ user_input }}",
        turnPromptTemplate: "Turn: {{ conversation }}",
      });

      await POST(makeRequest(baseBody));

      const runRecord = insertedValues[1] as { judgeConfigSnapshot: Record<string, unknown> };
      expect(runRecord.judgeConfigSnapshot).toHaveProperty("promptTemplate", "Custom: {{ user_input }}");
      expect(runRecord.judgeConfigSnapshot).toHaveProperty("turnPromptTemplate", "Turn: {{ conversation }}");
    });
  });

  describe("Boundary: 不同模板值组合", () => {
    it("两个模板字段均为 null 时正确传递", async () => {
      resetSelectResults({
        promptTemplate: null,
        turnPromptTemplate: null,
      });

      await POST(makeRequest(baseBody));

      const batchRecord = insertedValues[0] as { judgeConfigSnapshot: Record<string, unknown> };
      const runRecord = insertedValues[1] as { judgeConfigSnapshot: Record<string, unknown> };
      expect(batchRecord.judgeConfigSnapshot).toHaveProperty("promptTemplate", null);
      expect(batchRecord.judgeConfigSnapshot).toHaveProperty("turnPromptTemplate", null);
      expect(runRecord.judgeConfigSnapshot).toHaveProperty("promptTemplate", null);
      expect(runRecord.judgeConfigSnapshot).toHaveProperty("turnPromptTemplate", null);
    });

    it("仅 promptTemplate 非 null 时正确传递", async () => {
      resetSelectResults({
        promptTemplate: "Only prompt set",
        turnPromptTemplate: null,
      });

      await POST(makeRequest(baseBody));

      const runRecord = insertedValues[1] as { judgeConfigSnapshot: Record<string, unknown> };
      expect(runRecord.judgeConfigSnapshot).toHaveProperty("promptTemplate", "Only prompt set");
      expect(runRecord.judgeConfigSnapshot).toHaveProperty("turnPromptTemplate", null);
    });
  });

  describe("Blast Shield: batch 快照与 run 快照结构一致", () => {
    it("batch 级和 per-run 级快照包含相同字段集", async () => {
      resetSelectResults({
        promptTemplate: "P",
        turnPromptTemplate: "T",
      });

      await POST(makeRequest(baseBody));

      const batchSnapshot = (insertedValues[0] as { judgeConfigSnapshot: Record<string, unknown> }).judgeConfigSnapshot;
      const runSnapshot = (insertedValues[1] as { judgeConfigSnapshot: Record<string, unknown> }).judgeConfigSnapshot;

      const batchKeys = Object.keys(batchSnapshot).sort();
      const runKeys = Object.keys(runSnapshot).sort();
      expect(batchKeys).toEqual(runKeys);
      expect(batchKeys).toEqual(["dimensions", "name", "promptTemplate", "turnPromptTemplate"]);
    });
  });
});
