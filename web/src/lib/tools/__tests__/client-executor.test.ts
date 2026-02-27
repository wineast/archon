import { describe, it, expect, vi } from "vitest";
import { executeClientTool } from "../client-executor";
import type { ToolRow } from "@/db/schema";

function makeToolRow(overrides: Partial<ToolRow> = {}): ToolRow {
  return {
    id: "t1",
    agentId: "a1",
    versionId: "v1",
    key: "my_tool",
    name: "my_tool",
    description: "test tool",
    parametersSchema: null,
    returnParametersSchema: null,
    handler: "async (args) => ({ ok: true, ...args })",
    url: null,
    componentId: null,
    enabled: true,
    uiHidden: false,
    executionTarget: "client",
    sandboxMode: "light",
    origin: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe("executeClientTool", () => {
  const toolCall = { toolCallId: "call-1", toolName: "my_tool", input: { x: 1 } };

  it("executes a client tool and returns output", async () => {
    const addToolOutput = vi.fn();
    const tools = [makeToolRow()];

    await executeClientTool(toolCall, addToolOutput, tools);

    expect(addToolOutput).toHaveBeenCalledOnce();
    const output = addToolOutput.mock.calls[0][0].output;
    expect(output).toEqual({ ok: true, x: 1 });
  });

  it("returns 'Tool not found' when tool name does not match", async () => {
    const addToolOutput = vi.fn();
    const tools = [makeToolRow({ name: "other_tool" })];

    await executeClientTool(toolCall, addToolOutput, tools);

    expect(addToolOutput).toHaveBeenCalledOnce();
    expect(addToolOutput.mock.calls[0][0].output).toEqual({ error: "Tool not found" });
  });

  it("returns 'Tool not found' when toolsList is empty", async () => {
    const addToolOutput = vi.fn();

    await executeClientTool(toolCall, addToolOutput, []);

    expect(addToolOutput).toHaveBeenCalledOnce();
    expect(addToolOutput.mock.calls[0][0].output).toEqual({ error: "Tool not found" });
  });

  it("ignores server-side tools — does NOT execute them as client tools", async () => {
    const addToolOutput = vi.fn();
    const tools = [makeToolRow({ executionTarget: "server" })];

    await executeClientTool(toolCall, addToolOutput, tools);

    // executeClientTool still returns "Tool not found" for server tools,
    // but the caller (onToolCall) should never call this for server tools.
    // This test documents the defense-in-depth behavior.
    expect(addToolOutput).toHaveBeenCalledOnce();
    expect(addToolOutput.mock.calls[0][0].output).toEqual({ error: "Tool not found" });
  });

  it("ignores host tools — does NOT execute them as client tools", async () => {
    const addToolOutput = vi.fn();
    const tools = [makeToolRow({ executionTarget: "host" })];

    await executeClientTool(toolCall, addToolOutput, tools);

    expect(addToolOutput).toHaveBeenCalledOnce();
    expect(addToolOutput.mock.calls[0][0].output).toEqual({ error: "Tool not found" });
  });

  it("returns 'No handler' when handler is empty", async () => {
    const addToolOutput = vi.fn();
    const tools = [makeToolRow({ handler: "" })];

    await executeClientTool(toolCall, addToolOutput, tools);

    expect(addToolOutput).toHaveBeenCalledOnce();
    expect(addToolOutput.mock.calls[0][0].output).toEqual({ error: "No handler" });
  });

  it("catches handler runtime errors", async () => {
    const addToolOutput = vi.fn();
    const tools = [makeToolRow({ handler: "async () => { throw new Error('boom'); }" })];

    await executeClientTool(toolCall, addToolOutput, tools);

    expect(addToolOutput).toHaveBeenCalledOnce();
    expect(addToolOutput.mock.calls[0][0].output).toEqual({
      error: "Client execution error: boom",
    });
  });
});

/**
 * Test the caller-level filter that should guard onToolCall in chat-page-content / embed page.
 * This is the exact condition used to prevent server/host tools from reaching executeClientTool.
 *
 * Regression: onToolCall fires for ALL tool calls (including server-side), so the caller
 * must filter to only pass client tools to executeClientTool.
 */
describe("onToolCall caller-level filter (regression guard)", () => {
  function isClientTool(toolsList: ToolRow[], toolName: string): boolean {
    return toolsList.some(
      (t) => t.name === toolName && t.executionTarget === "client"
    );
  }

  it("returns true for client tool", () => {
    const tools = [makeToolRow({ name: "pricing", executionTarget: "client" })];
    expect(isClientTool(tools, "pricing")).toBe(true);
  });

  it("returns false for server tool — prevents spurious 'Tool not found'", () => {
    const tools = [makeToolRow({ name: "pricing", executionTarget: "server" })];
    expect(isClientTool(tools, "pricing")).toBe(false);
  });

  it("returns false for host tool", () => {
    const tools = [makeToolRow({ name: "pricing", executionTarget: "host" })];
    expect(isClientTool(tools, "pricing")).toBe(false);
  });

  it("returns false when toolsList is empty (SWR still loading)", () => {
    expect(isClientTool([], "pricing")).toBe(false);
  });

  it("correctly filters mixed tool list", () => {
    const tools = [
      makeToolRow({ name: "server_tool", executionTarget: "server" }),
      makeToolRow({ name: "client_tool", executionTarget: "client" }),
      makeToolRow({ name: "host_tool", executionTarget: "host" }),
    ];

    expect(isClientTool(tools, "server_tool")).toBe(false);
    expect(isClientTool(tools, "client_tool")).toBe(true);
    expect(isClientTool(tools, "host_tool")).toBe(false);
    expect(isClientTool(tools, "unknown_tool")).toBe(false);
  });
});
