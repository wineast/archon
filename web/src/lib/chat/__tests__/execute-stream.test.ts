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

let capturedStreamOpts: Record<string, unknown> | null = null;
let capturedOnFinish: ((...args: unknown[]) => void) | null = null;

vi.mock("ai", () => ({
  streamText: vi.fn((opts: Record<string, unknown>) => {
    capturedStreamOpts = opts;
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
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { getAgentEnabledTools, getAgentEnabledMcpServers } from "@/lib/pool/queries";
import { createMCPClient } from "@ai-sdk/mcp";
import { retrieveMemories } from "@/lib/memory/retrieve";
import { formatMemoriesForInjection } from "@/lib/memory/format-for-injection";
import { renderTemplate, disposeTemplateData } from "@/lib/template/render";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import { shouldCompress, compressMessages, getCompressionData, saveCompressionData } from "@/lib/chat/compress";
import { QuotaExceededError } from "@/lib/credits/errors";
import { serialiseConversation } from "@/lib/memory/extract";
import {
  agents as agentsTable,
  modelConfigs as modelConfigsTable,
  skills as skillsTable,
  ragConfigs as ragConfigsTable,
} from "@/db/schema";

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

// ═══════════════════════════════════════════════════════════════
// Shared helpers for new test blocks
// ═══════════════════════════════════════════════════════════════

const DEFAULT_AGENT_ROW = {
  orgId: "org-1",
  mcpEnabled: false,
  skillsEnabled: false,
  memoryEnabled: false,
  ragEnabled: false,
  contextCompressionEnabled: false,
};

const DEFAULT_MODEL_CONFIG = {
  modelId: "anthropic/claude-sonnet-4",
  systemPrompt: "system prompt",
  temperature: 0.7,
  isActive: true,
};

/** Table-dispatched DB mock — dispatches by `from(table)` reference. */
function setupDbMock(config: {
  agentRow?: Record<string, unknown>;
  modelConfig?: Record<string, unknown> | null;
  skillRows?: Record<string, unknown>[];
  ragConfig?: Record<string, unknown> | null;
} = {}) {
  const agent = { ...DEFAULT_AGENT_ROW, ...config.agentRow };
  const model = config.modelConfig === null
    ? null
    : { ...DEFAULT_MODEL_CONFIG, ...config.modelConfig };

  vi.mocked(db.select).mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: unknown) => {
      if (table === agentsTable) {
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([agent]),
          }),
        };
      }
      if (table === modelConfigsTable) {
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(model ? [model] : []),
          }),
        };
      }
      if (table === skillsTable) {
        return {
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(config.skillRows ?? []),
          }),
        };
      }
      if (table === ragConfigsTable) {
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(
              config.ragConfig ? [config.ragConfig] : []
            ),
          }),
        };
      }
      return {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      };
    }),
  } as never));
}

const mkMessages = (count: number): UIMessage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? "user" : "assistant",
    parts: [{ type: "text", text: `message ${i}` }],
  })) as UIMessage[];

// ═══════════════════════════════════════════════════════════════
// 1. Tool Discovery
// ═══════════════════════════════════════════════════════════════

describe("executeChatStream – tool discovery", () => {
  beforeEach(() => {
    capturedStreamOpts = null;
    capturedOnFinish = null;
    afterCallbacks.length = 0;
    mockRecordRuntimeEvents.mockClear();
    vi.mocked(getAgentEnabledTools).mockReset().mockResolvedValue([]);
    vi.mocked(getAgentEnabledMcpServers).mockReset().mockResolvedValue([]);
    vi.mocked(buildDynamicTools).mockReset().mockReturnValue({});
    vi.mocked(createMCPClient).mockReset();
  });

  it("filters out unregistered host tools from buildDynamicTools payload", async () => {
    setupDbMock();
    vi.mocked(getAgentEnabledTools).mockResolvedValue([
      { name: "server_tool", description: "d1", executionTarget: "server", handler: "h1", url: null, parametersSchema: null, returnParametersSchema: null, sandboxMode: "light" },
      { name: "host_ok", description: "d2", executionTarget: "host", handler: null, url: null, parametersSchema: null, returnParametersSchema: null, sandboxMode: "light" },
      { name: "host_missing", description: "d3", executionTarget: "host", handler: null, url: null, parametersSchema: null, returnParametersSchema: null, sandboxMode: "light" },
    ] as never);

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
      registeredHostTools: ["host_ok"],
    });

    const payloads = vi.mocked(buildDynamicTools).mock.calls[0][0];
    const names = payloads.map((p) => p.name);
    expect(names).toContain("server_tool");
    expect(names).toContain("host_ok");
    expect(names).not.toContain("host_missing");
  });

  it("merges MCP tools with correct prefix when mcpEnabled", async () => {
    setupDbMock({ agentRow: { mcpEnabled: true } });
    vi.mocked(getAgentEnabledMcpServers).mockResolvedValue([
      { key: "svc", id: "s1", url: "http://localhost:3001", transportType: "http", headers: null },
    ] as never);

    vi.mocked(createMCPClient).mockResolvedValue({
      tools: vi.fn().mockResolvedValue({ search: { execute: vi.fn() } }),
      close: vi.fn(),
    } as never);

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    const tools = capturedStreamOpts!.tools as Record<string, unknown>;
    expect(tools).toHaveProperty("mcp_svc__search");
  });

  it("records mcp_connect_error when MCP server connection fails", async () => {
    setupDbMock({ agentRow: { mcpEnabled: true } });
    vi.mocked(getAgentEnabledMcpServers).mockResolvedValue([
      { key: "bad_svc", id: "s2", url: "http://localhost:9999", transportType: "http", headers: null },
    ] as never);
    vi.mocked(createMCPClient).mockRejectedValue(new Error("connection refused"));

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    // Flush events via onFinish + after()
    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, reasoningTokens: 0 },
      response: { messages: [] },
      steps: [],
    });
    for (const cb of afterCallbacks) await cb();

    expect(mockRecordRuntimeEvents).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "mcp_connect_error",
          metadata: expect.objectContaining({ serverKey: "bad_svc" }),
        }),
      ])
    );
  });

  it("injects get_skill_detail tool when skills are enabled", async () => {
    setupDbMock({
      agentRow: { skillsEnabled: true },
      skillRows: [{ key: "greet", name: "Greeting", description: "Greets user", content: "Hello!" }],
    });

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    const tools = capturedStreamOpts!.tools as Record<string, unknown>;
    expect(tools).toHaveProperty("get_skill_detail");
    expect(capturedStreamOpts!.system as string).toContain("greet");
  });

  it("injects rag_search tool when RAG is enabled with config", async () => {
    setupDbMock({
      agentRow: { ragEnabled: true },
      ragConfig: { agentId: "agent-1", embeddingModel: "text-embedding-3-small", topK: 5 },
    });

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    const tools = capturedStreamOpts!.tools as Record<string, unknown>;
    expect(tools).toHaveProperty("rag_search");
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Memory / RAG Injection
// ═══════════════════════════════════════════════════════════════

describe("executeChatStream – memory injection", () => {
  beforeEach(() => {
    capturedStreamOpts = null;
    capturedOnFinish = null;
    afterCallbacks.length = 0;
    vi.mocked(retrieveMemories).mockReset();
    vi.mocked(formatMemoriesForInjection).mockReset();
    vi.mocked(convertToModelMessages).mockReset().mockImplementation(() => Promise.resolve([]));
  });

  it("appends memory to system prompt in system_prompt mode", async () => {
    setupDbMock({ agentRow: { memoryEnabled: true } });
    vi.mocked(retrieveMemories).mockResolvedValue({
      config: { injectionMode: "system_prompt" },
      items: [{ id: "m1" }],
    } as never);
    vi.mocked(formatMemoriesForInjection).mockReturnValue("<memory>facts</memory>");

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    const system = capturedStreamOpts!.system as string;
    expect(system).toContain("<memory>facts</memory>");
  });

  it("prepends memory as system message in context mode", async () => {
    setupDbMock({ agentRow: { memoryEnabled: true } });
    vi.mocked(retrieveMemories).mockResolvedValue({
      config: { injectionMode: "context" },
      items: [{ id: "m1" }],
    } as never);
    vi.mocked(formatMemoriesForInjection).mockReturnValue("<memory>ctx</memory>");

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    const msgs = capturedStreamOpts!.messages as Array<{ role: string; content: string }>;
    expect(msgs[0]).toEqual({ role: "system", content: "<memory>ctx</memory>" });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Template Rendering
// ═══════════════════════════════════════════════════════════════

describe("executeChatStream – template rendering", () => {
  beforeEach(() => {
    capturedStreamOpts = null;
    capturedOnFinish = null;
    afterCallbacks.length = 0;
    vi.mocked(renderTemplate).mockReset().mockResolvedValue("rendered prompt");
    vi.mocked(disposeTemplateData).mockReset();
  });

  it("passes hostContext to renderTemplate", async () => {
    setupDbMock();
    const hostCtx = { page: "checkout", user: "test" };

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
      hostContext: hostCtx,
    });

    expect(vi.mocked(renderTemplate)).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      { host: hostCtx },
    );
  });

  it("calls disposeTemplateData in onFinish after()", async () => {
    setupDbMock();

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, reasoningTokens: 0 },
      response: { messages: [] },
      steps: [],
    });
    for (const cb of afterCallbacks) await cb();

    expect(vi.mocked(disposeTemplateData)).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Context Compression
// ═══════════════════════════════════════════════════════════════

describe("executeChatStream – context compression", () => {
  beforeEach(() => {
    capturedStreamOpts = null;
    capturedOnFinish = null;
    afterCallbacks.length = 0;
    vi.mocked(shouldCompress).mockReset().mockReturnValue(false);
    vi.mocked(compressMessages).mockReset();
    vi.mocked(getCompressionData).mockReset().mockResolvedValue(null);
    vi.mocked(saveCompressionData).mockReset();
    vi.mocked(serialiseConversation).mockReset().mockReturnValue("user: hello\nassistant: hi");
    vi.mocked(convertToModelMessages).mockReset().mockImplementation(() => Promise.resolve([]));
  });

  it("triggers compression when inputTokens exceed threshold", async () => {
    setupDbMock({ agentRow: { contextCompressionEnabled: true } });
    vi.mocked(getCompressionData).mockResolvedValue({
      summary: "",
      compressedCount: 0,
      lastCompressedAt: new Date().toISOString(),
      lastInputTokens: 90000,
    });
    vi.mocked(shouldCompress).mockReturnValue(true);
    vi.mocked(compressMessages).mockResolvedValue("compressed summary");

    // Need > KEEP_RECENT_COUNT (mocked as 4) messages
    await executeChatStream({
      messages: mkMessages(6),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    expect(vi.mocked(compressMessages)).toHaveBeenCalled();
    expect(vi.mocked(saveCompressionData)).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({ summary: "compressed summary" }),
    );
  });

  it("skips compression when inputTokens below threshold", async () => {
    setupDbMock({ agentRow: { contextCompressionEnabled: true } });
    vi.mocked(getCompressionData).mockResolvedValue({
      summary: "",
      compressedCount: 0,
      lastCompressedAt: new Date().toISOString(),
      lastInputTokens: 10000,
    });
    vi.mocked(shouldCompress).mockReturnValue(false);

    await executeChatStream({
      messages: mkMessages(6),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    expect(vi.mocked(compressMessages)).not.toHaveBeenCalled();
  });

  it("injects compression summary as system message", async () => {
    setupDbMock({ agentRow: { contextCompressionEnabled: true } });
    vi.mocked(getCompressionData).mockResolvedValue({
      summary: "previous conversation summary",
      compressedCount: 2,
      lastCompressedAt: new Date().toISOString(),
      lastInputTokens: 5000,
    });

    await executeChatStream({
      messages: mkMessages(3),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    const msgs = capturedStreamOpts!.messages as Array<{ role: string; content: string }>;
    expect(msgs[0]).toEqual({
      role: "system",
      content: expect.stringContaining("previous conversation summary"),
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Error Handling
// ═══════════════════════════════════════════════════════════════

describe("executeChatStream – error handling", () => {
  beforeEach(() => {
    capturedStreamOpts = null;
    afterCallbacks.length = 0;
    mockRecordRuntimeEvents.mockClear();
    mockCreateSession.mockClear();
    mockSaveMessage.mockClear();
  });

  it("returns 400 for oversized hostContext (anonymous user)", async () => {
    setupDbMock();
    // Anonymous (userId=null) has 10KB limit
    const largeContext: Record<string, unknown> = {};
    for (let i = 0; i < 200; i++) {
      largeContext[`key_${i}`] = "x".repeat(100);
    }

    const response = await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: null,
      hostContext: largeContext,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("hostContext exceeds");
  });

  it("accepts hostContext within limit for authenticated user", async () => {
    setupDbMock();

    const response = await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
      hostContext: { page: "test" },
    });

    expect(response.status).not.toBe(400);
  });

  it("returns 402 for QuotaExceededError", async () => {
    setupDbMock();
    vi.mocked(streamText).mockImplementationOnce(() => {
      throw new QuotaExceededError("quota exceeded");
    });

    const response = await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error).toBe("quota_exceeded");
  });

  it("rethrows generic errors and records stream_error event", async () => {
    setupDbMock();
    vi.mocked(streamText).mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await expect(
      executeChatStream({
        messages: mkMessages(1),
        agentId: "agent-1",
        userId: "user-1",
        sessionId: "sess-1",
      })
    ).rejects.toThrow("boom");

    expect(mockRecordRuntimeEvents).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "stream_error",
          severity: "error",
        }),
      ])
    );
  });

  it("tolerates persistence failure without affecting stream", async () => {
    setupDbMock();
    mockCreateSession.mockRejectedValueOnce(new Error("db error"));

    const response = await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    // Stream succeeds despite persistence failure
    expect(response.status).toBe(200);
  });

  it("calls disposeTemplateData even when onFinish completes", async () => {
    setupDbMock();

    await executeChatStream({
      messages: mkMessages(1),
      agentId: "agent-1",
      userId: "user-1",
      sessionId: "sess-1",
    });

    capturedOnFinish!({
      totalUsage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, reasoningTokens: 0 },
      response: { messages: [] },
      steps: [],
    });
    for (const cb of afterCallbacks) await cb();

    expect(vi.mocked(disposeTemplateData)).toHaveBeenCalled();
  });
});
