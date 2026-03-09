import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock state ──

let selectCasesResult: unknown[] = [];
let selectToolsResult: unknown[] = [];
let selectCallCount = 0;
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();

const whereSelectMock = vi.fn(() => {
  selectCallCount++;
  return selectCallCount === 1 ? selectCasesResult : selectToolsResult;
});
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
    update: () => ({
      set: (...args: unknown[]) => {
        updateSetMock(...args);
        return {
          where: (...wArgs: unknown[]) => {
            updateWhereMock(...wArgs);
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  evalCases: {
    id: "id",
    agentId: "agent_id",
    versionId: "version_id",
    deletedAt: "deleted_at",
  },
  tools: { versionId: "version_id", deletedAt: "deleted_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNull: (col: unknown) => ({ op: "isNull", col }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi
    .fn()
    .mockResolvedValue({ user: { id: "user-1" }, agentId: "agent-1" }),
}));

vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockResolvedValue("version-1"),
}));

const executeToolHandlerMock = vi.fn();
vi.mock("@/lib/tools/execute-handler", () => ({
  executeToolHandler: (...args: unknown[]) => executeToolHandlerMock(...args),
}));

vi.mock("@/lib/tools/tool-context", () => ({
  createToolContext: vi.fn(() => ({
    wiki: {},
    dataset: {},
    fn: vi.fn(),
    ontology: {},
  })),
}));

// ── Import handler after mocks ──

const { POST } = await import("../../refresh-tools/route");

function makeRequest(agentId = "agent-1") {
  return new Request(
    `http://localhost/api/eval/cases/refresh-tools?agentId=${agentId}`,
    { method: "POST" }
  );
}

describe("POST /api/eval/cases/refresh-tools (batch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectCasesResult = [];
    selectToolsResult = [];
  });

  it("returns 400 when agentId is missing", async () => {
    const req = new Request(
      "http://localhost/api/eval/cases/refresh-tools",
      { method: "POST" }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 0 when no cases exist", async () => {
    selectCasesResult = [];
    selectToolsResult = [];

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.casesRefreshed).toBe(0);
    expect(body.totalToolCalls).toBe(0);
    expect(body.errors).toEqual([]);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it("skips cases without tool calls", async () => {
    selectCasesResult = [
      {
        id: "case-1",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          { id: "t1", role: "user", content: "hello" },
          { id: "t2", role: "assistant", content: "world" },
        ],
      },
    ];
    selectToolsResult = [];

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.casesRefreshed).toBe(0);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it("refreshes tool calls across multiple cases and saves to DB", async () => {
    selectCasesResult = [
      {
        id: "case-1",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          {
            id: "t1",
            role: "assistant",
            content: "",
            toolCalls: [{ name: "calc", args: { x: 1 }, result: "old" }],
          },
        ],
      },
      {
        id: "case-2",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          {
            id: "t1",
            role: "assistant",
            content: "",
            toolCalls: [
              { name: "calc", args: { x: 2 }, result: "old2" },
              { name: "lookup", args: { q: "a" }, result: "old3" },
            ],
          },
        ],
      },
    ];
    selectToolsResult = [
      { name: "calc", handler: "code", url: null },
      { name: "lookup", handler: "code2", url: null },
    ];
    executeToolHandlerMock
      .mockResolvedValueOnce({ v: "new1" })
      .mockResolvedValueOnce({ v: "new2" })
      .mockResolvedValueOnce({ v: "new3" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.casesRefreshed).toBe(2);
    expect(body.totalToolCalls).toBe(3);
    expect(body.errors).toEqual([]);
    // DB update called once per case with tool calls
    expect(updateSetMock).toHaveBeenCalledTimes(2);
  });

  it("collects errors without blocking other cases", async () => {
    selectCasesResult = [
      {
        id: "case-1",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          {
            id: "t1",
            role: "assistant",
            content: "",
            toolCalls: [{ name: "bad", args: {}, result: "old" }],
          },
        ],
      },
      {
        id: "case-2",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          {
            id: "t1",
            role: "assistant",
            content: "",
            toolCalls: [{ name: "good", args: {}, result: "old" }],
          },
        ],
      },
    ];
    selectToolsResult = [
      { name: "bad", handler: "code", url: null },
      { name: "good", handler: "code", url: null },
    ];
    executeToolHandlerMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    const res = await POST(makeRequest());
    const body = await res.json();

    // case-1 had error so refreshedCount=0 for it, no DB write
    // case-2 succeeded
    expect(body.casesRefreshed).toBe(1);
    expect(body.totalToolCalls).toBe(1);
    expect(body.errors).toEqual(['Tool "bad" execution failed: boom']);
    expect(updateSetMock).toHaveBeenCalledTimes(1);
  });

  it("DB 写入包含正确的刷新后 turns 内容", async () => {
    selectCasesResult = [
      {
        id: "case-1",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          { id: "t1", role: "user", content: "hi" },
          {
            id: "t2",
            role: "assistant",
            content: "reply",
            toolCalls: [{ name: "calc", args: { x: 1 }, result: "old" }],
          },
        ],
      },
    ];
    selectToolsResult = [{ name: "calc", handler: "code", url: null }];
    executeToolHandlerMock.mockResolvedValue({ v: "refreshed" });

    await POST(makeRequest());

    expect(updateSetMock).toHaveBeenCalledTimes(1);
    const savedTurns = updateSetMock.mock.calls[0][0].turns;
    // user turn 保持不变
    expect(savedTurns[0]).toEqual({
      id: "t1",
      role: "user",
      content: "hi",
    });
    // assistant turn 的 toolCall result 被刷新
    expect(savedTurns[1].toolCalls[0].result).toBe('{"v":"refreshed"}');
    // assistant turn 的其他字段保持不变
    expect(savedTurns[1].id).toBe("t2");
    expect(savedTurns[1].content).toBe("reply");
    expect(savedTurns[1].toolCalls[0].name).toBe("calc");
    expect(savedTurns[1].toolCalls[0].args).toEqual({ x: 1 });
  });

  it("混合用例：有工具调用的刷新，无工具调用的跳过——同一批次", async () => {
    selectCasesResult = [
      {
        id: "case-no-tc",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          { id: "t1", role: "user", content: "hello" },
          { id: "t2", role: "assistant", content: "world" },
        ],
      },
      {
        id: "case-with-tc",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          {
            id: "t1",
            role: "assistant",
            content: "",
            toolCalls: [{ name: "calc", args: {}, result: "old" }],
          },
        ],
      },
    ];
    selectToolsResult = [{ name: "calc", handler: "code", url: null }];
    executeToolHandlerMock.mockResolvedValue("new");

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.casesRefreshed).toBe(1);
    expect(body.totalToolCalls).toBe(1);
    // 仅对有工具调用的 case 写入 DB
    expect(updateSetMock).toHaveBeenCalledTimes(1);
  });

  it("does not write to DB when all tool calls fail", async () => {
    selectCasesResult = [
      {
        id: "case-1",
        agentId: "agent-1",
        versionId: "version-1",
        turns: [
          {
            id: "t1",
            role: "assistant",
            content: "",
            toolCalls: [{ name: "missing", args: {}, result: "old" }],
          },
        ],
      },
    ];
    selectToolsResult = []; // tool not found

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.casesRefreshed).toBe(0);
    expect(body.totalToolCalls).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(updateSetMock).not.toHaveBeenCalled();
  });
});
