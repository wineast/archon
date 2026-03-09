import { describe, it, expect, vi, beforeEach } from "vitest";

const executeToolHandlerMock = vi.fn();
vi.mock("@/lib/tools/execute-handler", () => ({
  executeToolHandler: (...args: unknown[]) => executeToolHandlerMock(...args),
}));

const { refreshTurnsToolCalls } = await import("../refresh-turns-tool-calls");

const fakeToolContext = {
  wiki: {},
  dataset: {},
  fn: vi.fn(),
  ontology: {},
} as never;

function makeToolMap(
  entries: Array<{ name: string; handler?: string | null; url?: string | null }>
) {
  return new Map(entries.map((e) => [e.name, e]));
}

describe("refreshTurnsToolCalls（公共刷新函数守护）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("标准矩阵：核心能力", () => {
    it("AC-2: 对包含工具调用的 turns 重新执行并返回新结果", async () => {
      const turns = [
        { id: "t1", role: "user" as const, content: "hi" },
        {
          id: "t2",
          role: "assistant" as const,
          content: "",
          toolCalls: [{ name: "calc", args: { x: 1 }, result: "old" }],
        },
      ];
      const toolMap = makeToolMap([{ name: "calc", handler: "code", url: null }]);
      executeToolHandlerMock.mockResolvedValue({ answer: 42 });

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(1);
      expect(result.errors).toEqual([]);
      expect(result.turns[1].toolCalls![0].result).toBe('{"answer":42}');
      // 原始 turn 的其他字段保持不变
      expect(result.turns[0]).toEqual(turns[0]);
      expect(result.turns[1].id).toBe("t2");
      expect(result.turns[1].content).toBe("");
    });

    it("AC-3: 无工具调用的 turns 原样返回，不触发执行", async () => {
      const turns = [
        { id: "t1", role: "user" as const, content: "hello" },
        { id: "t2", role: "assistant" as const, content: "world" },
      ];
      const toolMap = makeToolMap([]);

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.turns).toEqual(turns);
      expect(executeToolHandlerMock).not.toHaveBeenCalled();
    });

    it("AC-8: 单个工具失败不阻断其他工具——同一 turn 内多个 tool calls", async () => {
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [
            { name: "bad", args: {}, result: "old-bad" },
            { name: "good", args: {}, result: "old-good" },
          ],
        },
      ];
      const toolMap = makeToolMap([
        { name: "bad", handler: "code", url: null },
        { name: "good", handler: "code", url: null },
      ]);
      executeToolHandlerMock
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce("new-result");

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("boom");
      // 失败的保持原值
      expect(result.turns[0].toolCalls![0].result).toBe("old-bad");
      // 成功的更新
      expect(result.turns[0].toolCalls![1].result).toBe("new-result");
    });

    it("多轮多工具——跨 turn 批量刷新", async () => {
      const turns = [
        { id: "t1", role: "user" as const, content: "q1" },
        {
          id: "t2",
          role: "assistant" as const,
          content: "",
          toolCalls: [
            { name: "a", args: { n: 1 }, result: "old-a1" },
            { name: "b", args: { n: 2 }, result: "old-b" },
          ],
        },
        { id: "t3", role: "user" as const, content: "q2" },
        {
          id: "t4",
          role: "assistant" as const,
          content: "",
          toolCalls: [{ name: "a", args: { n: 3 }, result: "old-a2" }],
        },
      ];
      const toolMap = makeToolMap([
        { name: "a", handler: "code-a", url: null },
        { name: "b", handler: "code-b", url: null },
      ]);
      executeToolHandlerMock
        .mockResolvedValueOnce("new-a1")
        .mockResolvedValueOnce("new-b")
        .mockResolvedValueOnce("new-a2");

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(3);
      expect(result.errors).toEqual([]);
      expect(result.turns[1].toolCalls![0].result).toBe("new-a1");
      expect(result.turns[1].toolCalls![1].result).toBe("new-b");
      expect(result.turns[3].toolCalls![0].result).toBe("new-a2");
    });
  });

  describe("标准矩阵：边界条件", () => {
    it("工具未找到——保持原快照并记录错误", async () => {
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [{ name: "missing", args: {}, result: "original" }],
        },
      ];
      const toolMap = makeToolMap([]);

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(0);
      expect(result.errors).toEqual(['Tool "missing" not found']);
      expect(result.turns[0].toolCalls![0].result).toBe("original");
    });

    it("工具无 handler 也无 URL——保持原快照并记录错误", async () => {
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [{ name: "empty", args: {}, result: "original" }],
        },
      ];
      const toolMap = makeToolMap([{ name: "empty", handler: null, url: null }]);

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(0);
      expect(result.errors).toEqual(['Tool "empty" has no handler or URL']);
      expect(result.turns[0].toolCalls![0].result).toBe("original");
    });

    it("handler 返回对象——JSON.stringify 序列化", async () => {
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [{ name: "calc", args: {}, result: "old" }],
        },
      ];
      const toolMap = makeToolMap([{ name: "calc", handler: "code", url: null }]);
      executeToolHandlerMock.mockResolvedValue({ nested: { data: [1, 2] } });

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(1);
      expect(result.turns[0].toolCalls![0].result).toBe(
        '{"nested":{"data":[1,2]}}'
      );
    });

    it("handler 返回字符串——不双重 stringify", async () => {
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [{ name: "calc", args: {}, result: "old" }],
        },
      ];
      const toolMap = makeToolMap([{ name: "calc", handler: "code", url: null }]);
      executeToolHandlerMock.mockResolvedValue("plain text");

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.turns[0].toolCalls![0].result).toBe("plain text");
    });

    it("空 turns 数组——返回空结果", async () => {
      const result = await refreshTurnsToolCalls([], makeToolMap([]), fakeToolContext);

      expect(result.refreshedCount).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.turns).toEqual([]);
    });

    it("toolCalls 为空数组——视为无工具调用", async () => {
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [],
        },
      ];
      const toolMap = makeToolMap([]);

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(result.refreshedCount).toBe(0);
      expect(result.turns[0].toolCalls).toEqual([]);
    });
  });

  describe("约束守卫", () => {
    it("使用 executeToolHandler 执行 handler——不自行实现执行逻辑", async () => {
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [{ name: "calc", args: { x: 1 }, result: "old" }],
        },
      ];
      const toolMap = makeToolMap([{ name: "calc", handler: "my-code", url: null }]);
      executeToolHandlerMock.mockResolvedValue("ok");

      await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      expect(executeToolHandlerMock).toHaveBeenCalledWith(
        "my-code",
        { x: 1 },
        fakeToolContext
      );
    });

    it("不修改输入 turns——返回新对象", async () => {
      const originalTc = { name: "calc", args: { x: 1 }, result: "old" };
      const turns = [
        {
          id: "t1",
          role: "assistant" as const,
          content: "",
          toolCalls: [originalTc],
        },
      ];
      const toolMap = makeToolMap([{ name: "calc", handler: "code", url: null }]);
      executeToolHandlerMock.mockResolvedValue("new");

      const result = await refreshTurnsToolCalls(turns, toolMap, fakeToolContext);

      // 原始对象不被修改
      expect(originalTc.result).toBe("old");
      // 返回的是新对象
      expect(result.turns[0].toolCalls![0].result).toBe("new");
    });
  });
});
