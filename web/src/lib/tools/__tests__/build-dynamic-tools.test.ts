import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDynamicTools, wrapWithOutputValidation } from "@/app/api/chat/tools/build-dynamic-tools";
import type { ToolDefinitionPayload } from "../types";
import type { RuntimeEventInput } from "@/lib/runtime-events/record";
import { z } from "zod";

const opts = {
  toolCallId: "tc",
  messages: [] as never[],
  abortSignal: new AbortController().signal,
};

const EMPTY_PARAMS = {
  type: "object" as const,
  properties: {},
  required: [] as string[],
};

const validPayload: ToolDefinitionPayload = {
  name: "searchProducts",
  description: "Search products by keyword",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keyword" },
      limit: { type: "number", description: "Max results" },
    },
    required: ["query"],
  },
  handler: "(args) => ({ results: [], total: 0 })",
};

const noParamPayload: ToolDefinitionPayload = {
  name: "getCurrentTime",
  description: "Get current time",
  parameters: EMPTY_PARAMS,
  handler: "() => ({ time: '12:00' })",
};

describe("buildDynamicTools", () => {
  it("returns empty object for empty array", () => {
    const tools = buildDynamicTools([]);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it("creates a tool for each definition", () => {
    const tools = buildDynamicTools([validPayload, noParamPayload]);
    expect(Object.keys(tools)).toHaveLength(2);
    expect(tools).toHaveProperty("searchProducts");
    expect(tools).toHaveProperty("getCurrentTime");
  });

  it("tool has description", () => {
    const tools = buildDynamicTools([validPayload]);
    expect(tools.searchProducts.description).toBe("Search products by keyword");
  });

  describe("no handler", () => {
    it("returns error when handler is empty", async () => {
      const payload: ToolDefinitionPayload = {
        name: "noHandler",
        description: "Tool without handler",
        parameters: EMPTY_PARAMS,
        handler: "",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.noHandler.execute!({}, opts);
      expect(result).toEqual({
        error: 'Tool "noHandler" has no handler configured',
      });
    });

    it("returns error when handler is whitespace only", async () => {
      const payload: ToolDefinitionPayload = {
        name: "wsHandler",
        description: "Tool with whitespace handler",
        parameters: EMPTY_PARAMS,
        handler: "   ",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.wsHandler.execute!({}, opts);
      expect(result).toEqual({
        error: 'Tool "wsHandler" has no handler configured',
      });
    });
  });

  describe("remote handler (URL)", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("POSTs args to URL and returns JSON response", async () => {
      const mockResponse = { temperature: 72 };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const payload: ToolDefinitionPayload = {
        name: "weather",
        description: "Get weather",
        parameters: EMPTY_PARAMS,
        url: "https://api.weather.io/v1",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.weather.execute!({ city: "NYC" }, opts);

      expect(result).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.weather.io/v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: "NYC" }),
        }
      );
    });

    it("returns error object on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Not Found", { status: 404 })
      );

      const payload: ToolDefinitionPayload = {
        name: "broken_api",
        description: "Broken API",
        parameters: EMPTY_PARAMS,
        url: "https://api.example.com/broken",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.broken_api.execute!({}, opts);

      expect(result).toEqual({
        error: "Handler returned 404: Not Found",
      });
    });
  });

  describe("multiple definitions", () => {
    it("each tool executes independently", async () => {
      const payload1: ToolDefinitionPayload = {
        name: "tool1",
        description: "First",
        parameters: EMPTY_PARAMS,
        handler: "() => ({ a: 1 })",
      };
      const payload2: ToolDefinitionPayload = {
        name: "tool2",
        description: "Second",
        parameters: EMPTY_PARAMS,
        handler: "() => ({ b: 2 })",
      };
      const tools = buildDynamicTools([payload1, payload2]);

      const r1 = await tools.tool1.execute!({}, opts);
      const r2 = await tools.tool2.execute!({}, opts);
      expect(r1).toEqual({ a: 1 });
      expect(r2).toEqual({ b: 2 });
    });

    it("later definition with same name overwrites earlier", () => {
      const p1: ToolDefinitionPayload = {
        name: "dup",
        description: "First",
        parameters: EMPTY_PARAMS,
        handler: "() => ({})",
      };
      const p2: ToolDefinitionPayload = {
        name: "dup",
        description: "Second",
        parameters: EMPTY_PARAMS,
        handler: "() => ({})",
      };
      const tools = buildDynamicTools([p1, p2]);
      expect(tools.dup.description).toBe("Second");
    });
  });

  describe("parameter schema integration", () => {
    it("tool has inputSchema derived from parameters", () => {
      const tools = buildDynamicTools([validPayload]);
      expect(tools.searchProducts).toHaveProperty("inputSchema");
    });

    it("no-param tool has inputSchema for empty object", () => {
      const tools = buildDynamicTools([noParamPayload]);
      expect(tools.getCurrentTime).toHaveProperty("inputSchema");
    });
  });
});

describe("output validation", () => {
  const agentId = "agent-1";
  const outputSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  it("injects warning when output does not match schema", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => ({ name: 123, age: "not-a-number" });
    const wrapped = wrapWithOutputValidation(
      executor,
      "testTool",
      outputSchema,
      agentId,
      collector
    );
    const result = await wrapped({});
    expect(result._outputValidationWarning).toBeDefined();
    expect(typeof result._outputValidationWarning).toBe("string");
    expect(collector).toHaveLength(1);
    expect(collector[0].eventType).toBe("tool_output_validation");
    expect(collector[0].severity).toBe("warning");
  });

  it("returns result unchanged when output matches schema", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => ({ name: "Alice", age: 30 });
    const wrapped = wrapWithOutputValidation(
      executor,
      "testTool",
      outputSchema,
      agentId,
      collector
    );
    const result = await wrapped({});
    expect(result).toEqual({ name: "Alice", age: 30 });
    expect(result._outputValidationWarning).toBeUndefined();
    expect(collector).toHaveLength(0);
  });

  it("allows extra fields (passthrough) when defined fields are valid", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => ({ name: "Bob", age: 25, extra: true });
    const wrapped = wrapWithOutputValidation(
      executor,
      "testTool",
      outputSchema,
      agentId,
      collector
    );
    const result = await wrapped({});
    expect(result).toEqual({ name: "Bob", age: 25, extra: true });
    expect(result._outputValidationWarning).toBeUndefined();
    expect(collector).toHaveLength(0);
  });

  it("skips validation for error objects", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => ({ error: "Something went wrong" });
    const wrapped = wrapWithOutputValidation(
      executor,
      "testTool",
      outputSchema,
      agentId,
      collector
    );
    const result = await wrapped({});
    expect(result).toEqual({ error: "Something went wrong" });
    expect(collector).toHaveLength(0);
  });

  it("skips validation for null result", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => null;
    const wrapped = wrapWithOutputValidation(
      executor,
      "testTool",
      outputSchema,
      agentId,
      collector
    );
    const result = await wrapped({});
    expect(result).toBeNull();
    expect(collector).toHaveLength(0);
  });

  it("skips validation for array result", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => [1, 2, 3];
    const wrapped = wrapWithOutputValidation(
      executor,
      "testTool",
      outputSchema,
      agentId,
      collector
    );
    const result = await wrapped({});
    expect(result).toEqual([1, 2, 3]);
    expect(collector).toHaveLength(0);
  });

  it("integrates with buildDynamicTools when returnParameters are provided", async () => {
    const collector: RuntimeEventInput[] = [];
    const payload: ToolDefinitionPayload = {
      name: "myTool",
      description: "A tool with output validation",
      parameters: EMPTY_PARAMS,
      returnParameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "status" },
        },
        required: ["status"],
      },
      handler: "() => ({ status: 123 })",
    };
    const tools = buildDynamicTools([payload], undefined, agentId, collector);
    const result = await tools.myTool.execute!({}, opts);
    expect(result._outputValidationWarning).toBeDefined();
    expect(collector.some((e) => e.eventType === "tool_output_validation")).toBe(true);
  });

  it("no validation when returnParameters is not provided", async () => {
    const collector: RuntimeEventInput[] = [];
    const payload: ToolDefinitionPayload = {
      name: "myTool",
      description: "A tool without output validation",
      parameters: EMPTY_PARAMS,
      handler: "() => ({ anything: 'goes' })",
    };
    const tools = buildDynamicTools([payload], undefined, agentId, collector);
    const result = await tools.myTool.execute!({}, opts);
    expect(result._outputValidationWarning).toBeUndefined();
    expect(collector.every((e) => e.eventType !== "tool_output_validation")).toBe(true);
  });
});
