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

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { skillsEnabled: true, orgId: "org-1" },
          ]),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: { id: "id", skillsEnabled: "skillsEnabled", orgId: "orgId" },
  tools: { key: "key", enabled: "enabled", agentId: "agentId" },
}));

vi.mock("@/lib/slots", () => ({
  resolveSlot: vi.fn().mockResolvedValue({
    agentId: "",
    model: "anthropic/claude-sonnet-4",
    temperature: 0.3,
  }),
}));

vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockResolvedValue("mock-version-id"),
}));

vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn().mockResolvedValue({ modelId: "anthropic/claude-sonnet-4" }),
}));

vi.mock("@/lib/credits/errors", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {},
}));

vi.mock("../resource-summary", () => ({
  gatherResourceSummary: vi.fn().mockResolvedValue({ tools: [], schemas: [], datasets: [], wiki: [], functions: [], components: [], skills: [] }),
}));

vi.mock("../system-prompt", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue("system prompt"),
}));

vi.mock("../tools", () => ({
  buildAllTools: vi.fn().mockReturnValue({}),
}));

let capturedOnFinish: ((...args: unknown[]) => void) | null = null;

vi.mock("ai", () => ({
  streamText: vi.fn((opts: Record<string, unknown>) => {
    capturedOnFinish = opts.onFinish as typeof capturedOnFinish;
    return {
      toUIMessageStreamResponse: (sendOpts: unknown) => new Response("ok"),
    };
  }),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  stepCountIs: vi.fn().mockReturnValue(() => false),
}));

const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => { afterCallbacks.push(fn); },
}));

import { executeBuildChatStream } from "../execute-stream";
import type { UIMessage } from "ai";

describe("executeBuildChatStream monitoring", () => {
  beforeEach(() => {
    capturedOnFinish = null;
    afterCallbacks.length = 0;
    mockRecordUsage.mockClear();
    mockRecordRuntimeEvents.mockClear();
    mockCreateSession.mockClear();
    mockSaveMessage.mockClear();
  });

  const makeMessages = (count: number): UIMessage[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `message ${i}` }],
    })) as UIMessage[];

  it("records usage with source build-chat", async () => {
    const messages = makeMessages(1);
    await executeBuildChatStream({ messages, agentId: "agent-1", userId: "user-1", sessionId: "sess-1" });

    expect(capturedOnFinish).toBeTruthy();
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
        source: "build-chat",
        modelId: "anthropic/claude-sonnet-4",
      })
    );
  });

  it("records llm_call runtime event", async () => {
    const messages = makeMessages(1);
    await executeBuildChatStream({ messages, agentId: "agent-1", userId: "user-1", sessionId: "sess-1" });

    capturedOnFinish!({
      totalUsage: { inputTokens: 200, outputTokens: 80 },
      response: { messages: [] },
      steps: [{ toolCalls: [{}, {}] }],
    });

    for (const cb of afterCallbacks) await cb();

    expect(mockRecordRuntimeEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        agentId: "agent-1",
        sessionId: "sess-1",
        eventType: "llm_call",
        severity: "info",
        metadata: expect.objectContaining({
          toolCallCount: 2,
          stepCount: 1,
        }),
      }),
    ]);
  });

  it("creates session and saves messages on first message", async () => {
    const messages = makeMessages(1);
    await executeBuildChatStream({ messages, agentId: "agent-1", userId: "user-1", sessionId: "sess-1" });

    capturedOnFinish!({
      totalUsage: { inputTokens: 200, outputTokens: 80 },
      response: { messages: [] },
      steps: [],
    });

    for (const cb of afterCallbacks) await cb();

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess-1",
        agentId: "agent-1",
        userId: "user-1",
      })
    );
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
  });

  it("skips session persistence when no sessionId", async () => {
    const messages = makeMessages(1);
    await executeBuildChatStream({ messages, agentId: "agent-1", userId: "user-1" });

    capturedOnFinish!({
      totalUsage: { inputTokens: 200, outputTokens: 80 },
      response: { messages: [] },
      steps: [],
    });

    for (const cb of afterCallbacks) await cb();

    expect(mockRecordUsage).toHaveBeenCalled();
    expect(mockRecordRuntimeEvents).toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockSaveMessage).not.toHaveBeenCalled();
  });
});
