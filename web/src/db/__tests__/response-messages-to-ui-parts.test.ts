import { describe, it, expect } from "vitest";
import { responseMessagesToUIParts } from "../chat-persistence";
import type {
  AssistantModelMessage,
  ToolModelMessage,
} from "@ai-sdk/provider-utils";

type ResponseMessage = AssistantModelMessage | ToolModelMessage;

describe("responseMessagesToUIParts", () => {
  it("converts text-only assistant message", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello world" }],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([{ type: "text", text: "Hello world" }]);
  });

  it("converts string content to text part", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: "Hello world",
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([{ type: "text", text: "Hello world" }]);
  });

  it("skips empty string content", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: "",
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([]);
  });

  it("converts tool-call + tool-result into UI tool part", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "search_products",
            input: { query: "laptop" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-1",
            toolName: "search_products",
            output: { type: "json", value: { results: ["MacBook"] } },
          },
        ],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([
      {
        type: "tool-search_products",
        toolCallId: "tc-1",
        state: "output-available",
        input: { query: "laptop" },
        output: { results: ["MacBook"] },
      },
    ]);
  });

  it("converts text tool result output", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "get_info",
            input: {},
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-1",
            toolName: "get_info",
            output: { type: "text", value: "Some information" },
          },
        ],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([
      {
        type: "tool-get_info",
        toolCallId: "tc-1",
        state: "output-available",
        input: {},
        output: "Some information",
      },
    ]);
  });

  it("marks tool-call without result as input-available", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "slow_tool",
            input: { param: "value" },
          },
        ],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([
      {
        type: "tool-slow_tool",
        toolCallId: "tc-1",
        state: "input-available",
        input: { param: "value" },
      },
    ]);
  });

  it("converts mixed text and tool-call parts across multiple steps", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me search for that." },
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "search",
            input: { q: "test" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-1",
            toolName: "search",
            output: { type: "json", value: ["result1"] },
          },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Here are the results." },
        ],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([
      { type: "text", text: "Let me search for that." },
      {
        type: "tool-search",
        toolCallId: "tc-1",
        state: "output-available",
        input: { q: "test" },
        output: ["result1"],
      },
      { type: "text", text: "Here are the results." },
    ]);
  });

  it("handles multiple tool calls in a single assistant message", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "tool_a",
            input: { a: 1 },
          },
          {
            type: "tool-call",
            toolCallId: "tc-2",
            toolName: "tool_b",
            input: { b: 2 },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-1",
            toolName: "tool_a",
            output: { type: "json", value: { res: "a" } },
          },
          {
            type: "tool-result",
            toolCallId: "tc-2",
            toolName: "tool_b",
            output: { type: "text", value: "result b" },
          },
        ],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([
      {
        type: "tool-tool_a",
        toolCallId: "tc-1",
        state: "output-available",
        input: { a: 1 },
        output: { res: "a" },
      },
      {
        type: "tool-tool_b",
        toolCallId: "tc-2",
        state: "output-available",
        input: { b: 2 },
        output: "result b",
      },
    ]);
  });

  it("preserves providerOptions as callProviderMetadata", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "my_tool",
            input: {},
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-1",
            toolName: "my_tool",
            output: { type: "json", value: "ok" },
          },
        ],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([
      {
        type: "tool-my_tool",
        toolCallId: "tc-1",
        state: "output-available",
        input: {},
        output: "ok",
        callProviderMetadata: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
    ]);
  });

  it("handles reasoning parts", () => {
    const messages: ResponseMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "reasoning",
            text: "Thinking about this...",
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
          },
          { type: "text", text: "The answer is 42." },
        ],
      },
    ];

    const parts = responseMessagesToUIParts(messages);

    expect(parts).toEqual([
      {
        type: "reasoning",
        text: "Thinking about this...",
        providerMetadata: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
      { type: "text", text: "The answer is 42." },
    ]);
  });

  it("returns empty array for empty messages", () => {
    expect(responseMessagesToUIParts([])).toEqual([]);
  });
});
