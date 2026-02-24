import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import { parseUIMessagesToTurns } from "../import-turns";

describe("parseUIMessagesToTurns", () => {
  it("converts plain text messages", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there!" }],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns).toHaveLength(2);
    expect(turns[0].role).toBe("user");
    expect(turns[0].content).toBe("Hello");
    expect(turns[0].toolCalls).toBeUndefined();
    expect(turns[1].role).toBe("assistant");
    expect(turns[1].content).toBe("Hi there!");
  });

  it("extracts static tool calls from assistant messages", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "Let me check." },
          {
            type: "tool-getWeather" as `tool-${string}`,
            toolCallId: "tc1",
            state: "output-available",
            input: { city: "Beijing" },
            output: { temp: 25 },
          },
        ],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns).toHaveLength(1);
    expect(turns[0].content).toBe("Let me check.");
    expect(turns[0].toolCalls).toHaveLength(1);
    expect(turns[0].toolCalls![0].name).toBe("getWeather");
    expect(turns[0].toolCalls![0].args).toEqual({ city: "Beijing" });
    expect(turns[0].toolCalls![0].result).toBe('{"temp":25}');
  });

  it("extracts dynamic tool calls", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "searchDB",
            toolCallId: "tc2",
            state: "output-available",
            input: { query: "test" },
            output: [{ id: 1 }],
          },
        ],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns).toHaveLength(1);
    expect(turns[0].content).toBe("");
    expect(turns[0].toolCalls).toHaveLength(1);
    expect(turns[0].toolCalls![0].name).toBe("searchDB");
    expect(turns[0].toolCalls![0].args).toEqual({ query: "test" });
    expect(turns[0].toolCalls![0].result).toBe('[{"id":1}]');
  });

  it("skips system messages", () => {
    const messages: UIMessage[] = [
      {
        id: "0",
        role: "system",
        parts: [{ type: "text", text: "You are a bot." }],
      },
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hi" }],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe("user");
  });

  it("handles messages with empty parts", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns).toHaveLength(1);
    expect(turns[0].content).toBe("");
    expect(turns[0].toolCalls).toBeUndefined();
  });

  it("handles empty array input", () => {
    const turns = parseUIMessagesToTurns([]);
    expect(turns).toHaveLength(0);
  });

  it("concatenates multiple text parts with newline", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "First paragraph." },
          { type: "text", text: "Second paragraph." },
        ],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns[0].content).toBe("First paragraph.\nSecond paragraph.");
  });

  it("handles tool calls with no output", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "tool-doSomething" as `tool-${string}`,
            toolCallId: "tc1",
            state: "input-available",
            input: { x: 1 },
          },
        ],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns[0].toolCalls).toHaveLength(1);
    expect(turns[0].toolCalls![0].result).toBe("");
  });

  it("generates unique ids for each turn", () => {
    const messages: UIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "a" }] },
      { id: "2", role: "user", parts: [{ type: "text", text: "b" }] },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns[0].id).not.toBe(turns[1].id);
  });

  it("handles tool calls with null input gracefully", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "noArgs",
            toolCallId: "tc1",
            state: "output-available",
            input: null as unknown,
            output: "done",
          },
        ],
      },
    ];

    const turns = parseUIMessagesToTurns(messages);
    expect(turns[0].toolCalls![0].args).toEqual({});
    expect(turns[0].toolCalls![0].result).toBe('"done"');
  });
});
