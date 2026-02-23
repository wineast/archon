import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockRecordUsage = vi.fn().mockResolvedValue(undefined);
const mockRecordRuntimeEvents = vi.fn().mockResolvedValue(undefined);
const mockCreateSession = vi.fn().mockResolvedValue(undefined);
const mockSaveMessage = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/usage/record", () => ({
  recordUsage: (...args: unknown[]) => mockRecordUsage(...args),
}));

vi.mock("@/lib/runtime-events/record", () => ({
  recordRuntimeEvents: (...args: unknown[]) => mockRecordRuntimeEvents(...args),
}));

vi.mock("@/db/chat-persistence", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  saveMessage: (...args: unknown[]) => mockSaveMessage(...args),
  extractTextContent: (parts: unknown[]) => {
    return parts
      .filter(
        (p): p is { type: string; text: string } =>
          typeof p === "object" && p !== null && "type" in p && "text" in p
      )
      .map((p) => p.text)
      .join("\n");
  },
  responseMessagesToUIParts: () => [{ type: "text", text: "response" }],
}));

// DB mock — use simple inline mock that returns chainable methods
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: { id: "id", orgId: "orgId", mcpEnabled: "mcpEnabled", skillsEnabled: "skillsEnabled", memoryEnabled: "memoryEnabled", ragEnabled: "ragEnabled", contextCompressionEnabled: "contextCompressionEnabled" },
  modelConfigs: { agentId: "agentId", isActive: "isActive", deletedAt: "deletedAt" },
  skills: { agentId: "agentId", enabled: "enabled", deletedAt: "deletedAt", order: "order", key: "key" },
  ragConfigs: { agentId: "agentId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  asc: vi.fn(),
}));

vi.mock("@/lib/pool/queries", () => ({
  getAgentEnabledTools: vi.fn().mockResolvedValue([]),
  getAgentEnabledMcpServers: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockResolvedValue("mock-version-id"),
}));

vi.mock("@/lib/memory/retrieve", () => ({
  retrieveMemories: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/memory/format-for-injection", () => ({
  formatMemoriesForInjection: vi.fn().mockReturnValue(""),
}));

vi.mock("@/lib/memory/extract", () => ({
  extractMemories: vi.fn().mockResolvedValue(undefined),
  serialiseConversation: vi.fn().mockReturnValue(""),
}));

vi.mock("@/lib/rag/search", () => ({
  ragSearch: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/template/render", () => ({
  renderTemplate: vi.fn().mockResolvedValue("rendered prompt"),
  gatherTemplateData: vi.fn().mockResolvedValue({ defsMap: new Map() }),
  disposeTemplateData: vi.fn(),
}));

vi.mock("@/lib/schemas/resolve-inline", () => ({
  resolveInlineSchema: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/api/chat/tools/build-dynamic-tools", () => ({
  buildDynamicTools: vi.fn().mockReturnValue({}),
}));

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: vi.fn(),
}));

vi.mock("../wrap-mcp-tool", () => ({
  wrapMcpExecuteWithTiming: vi.fn(),
}));

vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn().mockResolvedValue({ modelId: "anthropic/claude-sonnet-4" }),
}));

vi.mock("@/lib/credits/errors", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {},
}));

vi.mock("@/lib/chat/compress", () => ({
  shouldCompress: vi.fn().mockReturnValue(false),
  compressMessages: vi.fn(),
  getCompressionData: vi.fn().mockResolvedValue(null),
  saveCompressionData: vi.fn(),
  getInputMax: vi.fn().mockResolvedValue(100000),
  KEEP_RECENT_COUNT: 4,
}));

let capturedOnFinish: ((...args: unknown[]) => void) | null = null;

vi.mock("ai", () => ({
  streamText: vi.fn((opts: Record<string, unknown>) => {
    capturedOnFinish = opts.onFinish as typeof capturedOnFinish;
    return {
      toUIMessageStreamResponse: () => new Response("ok"),
    };
  }),
  tool: vi.fn((opts: unknown) => opts),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  stepCountIs: vi.fn().mockReturnValue(() => false),
}));

const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => { afterCallbacks.push(fn); },
}));

import { executeChatStream } from "../execute-stream";
import { db } from "@/db";
import type { UIMessage } from "ai";

describe("executeChatStream – no model config error", () => {
  beforeEach(() => {
    // Setup DB: agent row exists but no active model config
    let callCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{
          orgId: "org-1",
          mcpEnabled: false,
          skillsEnabled: false,
          memoryEnabled: false,
          ragEnabled: false,
          contextCompressionEnabled: false,
        }]);
      }
      // No active model config
      return Promise.resolve([]);
    });
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
  });

  it("returns 400 with structured error code no_model_config", async () => {
    const messages: UIMessage[] = [{
      id: "msg-0",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    }] as UIMessage[];

    const response = await executeChatStream({
      messages,
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("no_model_config");
  });
});

describe("executeChatStream persistence", () => {
  beforeEach(() => {
    capturedOnFinish = null;
    afterCallbacks.length = 0;
    mockRecordUsage.mockClear();
    mockRecordRuntimeEvents.mockClear();
    mockCreateSession.mockClear();
    mockSaveMessage.mockClear();

    // Setup DB mock to return agent row (call 1) and model config (call 2)
    let callCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{
          orgId: "org-1",
          mcpEnabled: false,
          skillsEnabled: false,
          memoryEnabled: false,
          ragEnabled: false,
          contextCompressionEnabled: false,
        }]);
      }
      return Promise.resolve([{
        modelId: "anthropic/claude-sonnet-4",
        systemPrompt: "system prompt",
        temperature: 0.7,
        isActive: true,
      }]);
    });
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
  });

  const makeMessages = (count: number): UIMessage[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `message ${i}` }],
    })) as UIMessage[];

  it("creates session and saves user message eagerly before streaming", async () => {
    const messages = makeMessages(1);
    await executeChatStream({
      messages,
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    // Session + user message saved before streamText (eagerly)
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess-1",
        agentId: "agent-1",
        userId: "user-1",
      })
    );
    expect(mockSaveMessage).toHaveBeenCalledTimes(1);
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess-1", role: "user" })
    );
  });

  it("saves assistant message in after() callback", async () => {
    const messages = makeMessages(1);
    await executeChatStream({
      messages,
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    // Trigger onFinish
    capturedOnFinish!({
      totalUsage: { inputTokens: 200, outputTokens: 80, cachedInputTokens: 0, reasoningTokens: 0 },
      response: { messages: [] },
      steps: [],
    });
    for (const cb of afterCallbacks) await cb();

    // User message (eager) + assistant message (after) = 2
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
  });

  it("skips persistence when no sessionId", async () => {
    const messages = makeMessages(1);
    await executeChatStream({
      messages,
      agentId: "agent-1",
      userId: "user-1",
    });

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockSaveMessage).not.toHaveBeenCalled();
  });

  it("does not create session on subsequent messages", async () => {
    const messages = makeMessages(3);
    await executeChatStream({
      messages,
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    expect(mockCreateSession).not.toHaveBeenCalled();
    // Still saves user message eagerly
    expect(mockSaveMessage).toHaveBeenCalledTimes(1);
  });

  it("records usage after streaming completes", async () => {
    const messages = makeMessages(1);
    await executeChatStream({
      messages,
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    capturedOnFinish!({
      totalUsage: { inputTokens: 200, outputTokens: 80, cachedInputTokens: 0, reasoningTokens: 0 },
      response: { messages: [] },
      steps: [],
    });
    for (const cb of afterCallbacks) await cb();

    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-1",
        userId: "user-1",
        sessionId: "sess-1",
        source: "chat",
      })
    );
  });
});
