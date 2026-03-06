import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Shared state for mock control ──

let selectCaseResult: unknown[] = [];
let selectToolsResult: unknown[] = [];
let selectCallCount = 0;

const whereSelectMock = vi.fn(() => {
  selectCallCount++;
  // First select = evalCases, second select = tools
  return selectCallCount === 1 ? selectCaseResult : selectToolsResult;
});
const fromMock = vi.fn(() => ({ where: whereSelectMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@/db", () => ({
  db: {
    select: () => selectMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  evalCases: { id: "id", versionId: "version_id", deletedAt: "deleted_at" },
  tools: { versionId: "version_id", deletedAt: "deleted_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => conditions,
  isNull: (col: unknown) => ({ op: "isNull", col }),
}));

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: vi.fn().mockResolvedValue({ user: { id: "user-1" }, agentId: "agent-1" }),
}));

const executeToolHandlerMock = vi.fn();
vi.mock("@/lib/tools/execute-handler", () => ({
  executeToolHandler: (...args: unknown[]) => executeToolHandlerMock(...args),
}));

vi.mock("@/lib/tools/tool-context", () => ({
  createToolContext: vi.fn(() => ({ wiki: {}, dataset: {}, fn: vi.fn(), ontology: {} })),
}));

// ── Import handler after mocks ──

const { POST } = await import("../[id]/refresh-tools/route");

const params = Promise.resolve({ id: "case-1" });

function makeRequest() {
  return new Request("http://localhost/api/eval/cases/case-1/refresh-tools", {
    method: "POST",
  });
}

describe("POST /api/eval/cases/[id]/refresh-tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectCaseResult = [];
    selectToolsResult = [];
  });

  it("returns 404 when case not found", async () => {
    selectCaseResult = [];
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("refreshes handler-based tool calls and returns updated turns", async () => {
    selectCaseResult = [{
      id: "case-1",
      agentId: "agent-1",
      versionId: "version-1",
      turns: [
        { id: "t1", role: "user", content: "hi" },
        {
          id: "t2",
          role: "assistant",
          content: "result",
          toolCalls: [
            { name: "calc", args: { x: 1 }, result: "old-result" },
          ],
        },
      ],
    }];
    selectToolsResult = [
      { name: "calc", handler: "export default async (args) => args.x + 1", url: null },
    ];
    executeToolHandlerMock.mockResolvedValue({ answer: 2 });

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refreshedCount).toBe(1);
    expect(body.errors).toEqual([]);
    expect(body.turns).toHaveLength(2);
    expect(body.turns[1].toolCalls[0].result).toBe('{"answer":2}');
    expect(executeToolHandlerMock).toHaveBeenCalledOnce();
  });

  it("keeps original result when tool is not found", async () => {
    selectCaseResult = [{
      id: "case-1",
      agentId: "agent-1",
      versionId: "version-1",
      turns: [
        {
          id: "t1",
          role: "assistant",
          content: "",
          toolCalls: [
            { name: "missing_tool", args: {}, result: "old" },
          ],
        },
      ],
    }];
    selectToolsResult = []; // no tools found

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(body.refreshedCount).toBe(0);
    expect(body.errors).toEqual(['Tool "missing_tool" not found']);
    expect(body.turns[0].toolCalls[0].result).toBe("old");
  });

  it("keeps original result when handler execution fails", async () => {
    selectCaseResult = [{
      id: "case-1",
      agentId: "agent-1",
      versionId: "version-1",
      turns: [
        {
          id: "t1",
          role: "assistant",
          content: "",
          toolCalls: [
            { name: "calc", args: {}, result: "old" },
          ],
        },
      ],
    }];
    selectToolsResult = [
      { name: "calc", handler: "broken code", url: null },
    ];
    executeToolHandlerMock.mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(body.refreshedCount).toBe(0);
    expect(body.errors).toEqual(['Tool "calc" execution failed: boom']);
    expect(body.turns[0].toolCalls[0].result).toBe("old");
  });

  it("skips turns without tool calls", async () => {
    selectCaseResult = [{
      id: "case-1",
      agentId: "agent-1",
      versionId: "version-1",
      turns: [
        { id: "t1", role: "user", content: "hello" },
        { id: "t2", role: "assistant", content: "world" },
      ],
    }];
    selectToolsResult = [];

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(body.refreshedCount).toBe(0);
    expect(body.errors).toEqual([]);
  });

  it("handles tool with no handler or URL", async () => {
    selectCaseResult = [{
      id: "case-1",
      agentId: "agent-1",
      versionId: "version-1",
      turns: [
        {
          id: "t1",
          role: "assistant",
          content: "",
          toolCalls: [{ name: "empty", args: {}, result: "old" }],
        },
      ],
    }];
    selectToolsResult = [
      { name: "empty", handler: null, url: null },
    ];

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(body.refreshedCount).toBe(0);
    expect(body.errors).toEqual(['Tool "empty" has no handler or URL']);
  });

  it("stringifies non-string results from handler", async () => {
    selectCaseResult = [{
      id: "case-1",
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
    }];
    selectToolsResult = [
      { name: "calc", handler: "code", url: null },
    ];
    // Return a plain string (should be kept as-is, not double-stringified)
    executeToolHandlerMock.mockResolvedValue("plain text");

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(body.refreshedCount).toBe(1);
    expect(body.turns[0].toolCalls[0].result).toBe("plain text");
  });

  it("refreshes multiple tool calls across multiple turns", async () => {
    selectCaseResult = [{
      id: "case-1",
      agentId: "agent-1",
      versionId: "version-1",
      turns: [
        { id: "t1", role: "user", content: "hi" },
        {
          id: "t2",
          role: "assistant",
          content: "",
          toolCalls: [
            { name: "a", args: { n: 1 }, result: "old-a" },
            { name: "b", args: { n: 2 }, result: "old-b" },
          ],
        },
        { id: "t3", role: "user", content: "next" },
        {
          id: "t4",
          role: "assistant",
          content: "",
          toolCalls: [
            { name: "a", args: { n: 3 }, result: "old-a2" },
          ],
        },
      ],
    }];
    selectToolsResult = [
      { name: "a", handler: "code-a", url: null },
      { name: "b", handler: "code-b", url: null },
    ];
    executeToolHandlerMock
      .mockResolvedValueOnce({ v: "new-a1" })
      .mockResolvedValueOnce({ v: "new-b" })
      .mockResolvedValueOnce({ v: "new-a2" });

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(body.refreshedCount).toBe(3);
    expect(body.errors).toEqual([]);
    expect(executeToolHandlerMock).toHaveBeenCalledTimes(3);
    // Verify turns are returned with refreshed results
    expect(body.turns[1].toolCalls[0].result).toBe('{"v":"new-a1"}');
    expect(body.turns[1].toolCalls[1].result).toBe('{"v":"new-b"}');
    expect(body.turns[3].toolCalls[0].result).toBe('{"v":"new-a2"}');
  });
});
