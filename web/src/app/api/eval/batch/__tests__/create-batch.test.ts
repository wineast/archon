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

// Track sequential select calls: concurrency check, modelConfig, judgeModelConfig, judgeConfig
let selectCallIndex = 0;
const selectResults: unknown[][] = [
  // concurrency check: no running batches
  [],
  // modelConfig
  [{ id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null }],
  // judgeModelConfig
  [{ id: "jmc-1", modelId: "gpt-4-judge", systemPrompt: "Judge this", temperature: 0.1, agentId: null }],
  // judgeConfig
  [{ id: "jc-1", name: "Default", dimensions: [{ key: "quality", label: "Quality", weight: 1 }], promptTemplate: "Custom prompt: {{ user_input }}", turnPromptTemplate: "Turn prompt: {{ conversation }}" }],
];

const limitMock = vi.fn(() => selectResults[selectCallIndex++]);
const whereSelectMock = vi.fn(() => {
  const idx = selectCallIndex;
  if (idx === 0) {
    return { limit: limitMock };
  }
  return selectResults[selectCallIndex++];
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

const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["evt-1"] });
vi.mock("@/inngest/client", () => ({
  inngest: { send: (...args: unknown[]) => inngestSendMock(...args) },
}));

const { POST } = await import("../route");

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/eval/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseCases = [{ id: "c1", key: "test", name: "Test", mode: "single", turns: [], assertions: [], expectedOutput: "" }];

const baseBody = {
  agentId: "agent-1",
  judgeAgentId: "judge-agent-1",
  totalCases: 1,
  cases: baseCases,
  repeatCount: 1,
};

describe("POST /api/eval/batch (create batch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    insertCallIndex = 0;
    selectCallIndex = 0;
    selectResults[0] = [];
    selectResults[1] = [{ id: "mc-1", modelId: "gpt-4", systemPrompt: "You are helpful", temperature: 0.7, agentId: null }];
    selectResults[2] = [{ id: "jmc-1", modelId: "gpt-4-judge", systemPrompt: "Judge this", temperature: 0.1, agentId: null }];
    selectResults[3] = [{ id: "jc-1", name: "Default", dimensions: [{ key: "quality", label: "Quality", weight: 1 }], promptTemplate: "Custom prompt: {{ user_input }}", turnPromptTemplate: "Turn prompt: {{ conversation }}" }];
  });

  it("batch record judgeConfigSnapshot includes promptTemplate and turnPromptTemplate", async () => {
    await POST(makeRequest(baseBody));

    // insertedValues[0] is the batch record
    expect(insertedValues[0]).toMatchObject({
      judgeConfigSnapshot: {
        name: "Default",
        dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
        promptTemplate: "Custom prompt: {{ user_input }}",
        turnPromptTemplate: "Turn prompt: {{ conversation }}",
      },
    });
  });

  it("per-run record judgeConfigSnapshot includes promptTemplate and turnPromptTemplate", async () => {
    await POST(makeRequest(baseBody));

    // insertedValues[1] is the per-run record
    expect(insertedValues[1]).toMatchObject({
      judgeConfigSnapshot: {
        name: "Default",
        dimensions: [{ key: "quality", label: "Quality", weight: 1 }],
        promptTemplate: "Custom prompt: {{ user_input }}",
        turnPromptTemplate: "Turn prompt: {{ conversation }}",
      },
    });
  });

  it("creates batch and run records, returns batchId", async () => {
    const res = await POST(makeRequest(baseBody));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ batchId: "batch-1", chatModel: "gpt-4", status: "running" });
  });

  it("sends inngest event with batchId and runConfigs", async () => {
    await POST(makeRequest(baseBody));

    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "eval/batch.created",
      data: {
        batchId: "batch-1",
        agentId: "agent-1",
        runConfigs: [{ runId: "run-1", caseIds: ["c1"] }],
        userId: "user-1",
      },
    });
  });
});
