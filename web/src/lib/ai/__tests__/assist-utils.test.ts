import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module under test
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

vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "user-123" }),
}));

vi.mock("@/lib/ai/get-org-id", () => ({
  getOrgIdByAgentId: vi.fn().mockResolvedValue("org-1"),
}));

vi.mock("@/lib/slots", () => ({
  resolveSlot: vi.fn().mockResolvedValue({
    agentId: "assist-agent-1",
    model: "anthropic/claude-sonnet-4",
    temperature: 0.7,
  }),
}));

vi.mock("@/lib/ai/resolve-model", () => ({
  resolveModel: vi.fn().mockResolvedValue({ modelId: "anthropic/claude-sonnet-4" }),
}));

vi.mock("@/lib/credits/errors", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {},
}));

const mockRenderTemplate = vi.fn().mockResolvedValue("rendered system prompt");
const mockGatherTemplateData = vi.fn().mockResolvedValue({
  resolvedVars: {},
  docs: [],
  toolRows: [],
  defsMap: {},
  datasetEntries: {},
  ontologyTypes: [],
});

vi.mock("@/lib/template/render", () => ({
  renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
  gatherTemplateData: (...args: unknown[]) => mockGatherTemplateData(...args),
}));

vi.mock("@/lib/versions/resolve", () => ({
  resolveEditingVersionId: vi.fn().mockResolvedValue("version-1"),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => [{ systemPrompt: "raw LiquidJS template" }],
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  modelConfigs: {
    agentId: "agentId",
    isActive: "isActive",
    systemPrompt: "systemPrompt",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => ({ a, b }),
}));

// Capture the onFinish callback from streamText
let capturedOnFinish: ((...args: unknown[]) => void) | null = null;
let capturedSystem: string | undefined;
let capturedTools: Record<string, unknown> | undefined;

vi.mock("ai", () => ({
  streamText: vi.fn((opts: Record<string, unknown>) => {
    capturedOnFinish = opts.onFinish as typeof capturedOnFinish;
    capturedSystem = opts.system as string;
    capturedTools = opts.tools as Record<string, unknown>;
    return {
      toUIMessageStreamResponse: () => new Response("ok"),
    };
  }),
  tool: vi.fn((opts: unknown) => opts),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
}));

// Mock next/server after()
const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => { afterCallbacks.push(fn); },
  NextResponse: class NextResponse extends Response {
    static json(data: unknown, init?: ResponseInit) { return new Response(JSON.stringify(data), init); }
  },
}));

import { createAssistHandler, buildAssistTools } from "../assist-utils";
import type { UIMessage } from "ai";

describe("buildAssistTools", () => {
  it("creates update and edit tool pair", () => {
    const tools = buildAssistTools("prompt");
    expect(tools).toHaveProperty("update_prompt");
    expect(tools).toHaveProperty("edit_prompt");
  });

  it("names tools after the entity", () => {
    const tools = buildAssistTools("code");
    expect(Object.keys(tools)).toEqual(["update_code", "edit_code"]);
  });
});

describe("createAssistHandler", () => {
  beforeEach(() => {
    capturedOnFinish = null;
    capturedSystem = undefined;
    capturedTools = undefined;
    afterCallbacks.length = 0;
    mockRecordUsage.mockClear();
    mockRecordRuntimeEvents.mockClear();
    mockCreateSession.mockClear();
    mockSaveMessage.mockClear();
    mockRenderTemplate.mockClear();
    mockGatherTemplateData.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeMessages = (count: number): UIMessage[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `message ${i}` }],
    })) as UIMessage[];

  const config = {
    source: "prompt-assist" as const,
    buildParams: async (body: Record<string, unknown>) => ({
      messages: body.messages as UIMessage[],
      agentId: body.agentId as string | undefined,
      sessionId: body.sessionId as string | undefined,
      fieldContext: "system-prompt",
      currentContent: "current prompt text",
      entity: "prompt",
    }),
  };

  function makeRequest(body: Record<string, unknown>) {
    return new Request("http://localhost/api/prompt-assist", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("loads system prompt from DB and renders with template engine", async () => {
    const handler = createAssistHandler(config);
    const messages = makeMessages(1);
    await handler(makeRequest({ messages, agentId: "agent-1", sessionId: "sess-1" }));

    // gatherTemplateData should be called with assist agent's ID and version
    expect(mockGatherTemplateData).toHaveBeenCalledWith("assist-agent-1", "version-1");

    // renderTemplate should be called with raw prompt, data, and extraVars
    expect(mockRenderTemplate).toHaveBeenCalledWith(
      "raw LiquidJS template",
      expect.anything(),
      expect.objectContaining({
        fieldContext: "system-prompt",
        currentContent: "current prompt text",
        entity: "prompt",
      }),
    );

    // The rendered system prompt should be passed to streamText
    expect(capturedSystem).toBe("rendered system prompt");
  });

  it("builds tools from entity parameter", async () => {
    const handler = createAssistHandler(config);
    const messages = makeMessages(1);
    await handler(makeRequest({ messages, agentId: "agent-1", sessionId: "sess-1" }));

    expect(capturedTools).toHaveProperty("update_prompt");
    expect(capturedTools).toHaveProperty("edit_prompt");
  });

  it("records usage on finish", async () => {
    const handler = createAssistHandler(config);
    const messages = makeMessages(1);
    await handler(makeRequest({ messages, agentId: "agent-1", sessionId: "sess-1" }));

    expect(capturedOnFinish).toBeTruthy();
    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 10, reasoningTokens: 0 },
      response: { messages: [] },
      steps: [],
    });

    // Flush after callbacks
    for (const cb of afterCallbacks) await cb();

    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        agentId: "agent-1",
        userId: "user-123",
        sessionId: "sess-1",
        modelId: "anthropic/claude-sonnet-4",
        source: "prompt-assist",
        usage: expect.objectContaining({ inputTokens: 100, outputTokens: 50 }),
      })
    );
  });

  it("records runtime events on finish", async () => {
    const handler = createAssistHandler(config);
    const messages = makeMessages(1);
    await handler(makeRequest({ messages, agentId: "agent-1", sessionId: "sess-1" }));

    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50 },
      response: { messages: [] },
      steps: [{ toolCalls: [{}] }],
    });

    for (const cb of afterCallbacks) await cb();

    expect(mockRecordRuntimeEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        agentId: "agent-1",
        sessionId: "sess-1",
        eventType: "llm_call",
        severity: "info",
        metadata: expect.objectContaining({
          modelId: "anthropic/claude-sonnet-4",
          toolCallCount: 1,
          stepCount: 1,
          source: "prompt-assist",
        }),
      }),
    ]);
  });

  it("creates session and saves user message eagerly (before streaming), saves assistant in after()", async () => {
    const handler = createAssistHandler(config);
    const messages = makeMessages(1);
    await handler(makeRequest({ messages, agentId: "agent-1", sessionId: "sess-1" }));

    // Session + user message saved eagerly (before onFinish)
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess-1",
        model: "anthropic/claude-sonnet-4",
        agentId: "agent-1",
        userId: "user-123",
      })
    );
    expect(mockSaveMessage).toHaveBeenCalledTimes(1); // user message only
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess-1", role: "user" })
    );

    // Trigger onFinish → after callbacks for assistant message
    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50 },
      response: { messages: [] },
      steps: [],
    });
    for (const cb of afterCallbacks) await cb();

    // Now assistant message also saved
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
  });

  it("skips session persistence when no sessionId", async () => {
    const handler = createAssistHandler(config);
    const messages = makeMessages(1);
    await handler(makeRequest({ messages, agentId: "agent-1" }));

    // No eager persist without sessionId
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockSaveMessage).not.toHaveBeenCalled();

    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50 },
      response: { messages: [] },
      steps: [],
    });

    for (const cb of afterCallbacks) await cb();

    // Usage and events should still be recorded
    expect(mockRecordUsage).toHaveBeenCalled();
    expect(mockRecordRuntimeEvents).toHaveBeenCalled();
    // But no session/message persistence
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockSaveMessage).not.toHaveBeenCalled();
  });

  it("does not create session on subsequent messages but still saves user message eagerly", async () => {
    const handler = createAssistHandler(config);
    const messages = makeMessages(3); // 3 messages = not first
    await handler(makeRequest({ messages, agentId: "agent-1", sessionId: "sess-1" }));

    // No session creation for subsequent messages
    expect(mockCreateSession).not.toHaveBeenCalled();
    // User message saved eagerly
    expect(mockSaveMessage).toHaveBeenCalledTimes(1);

    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50 },
      response: { messages: [] },
      steps: [],
    });
    for (const cb of afterCallbacks) await cb();

    // Assistant also saved
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
  });
});
