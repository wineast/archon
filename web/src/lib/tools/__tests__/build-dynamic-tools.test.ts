import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import type { ToolDefinitionPayload } from "../types";

const opts = {
  toolCallId: "tc",
  messages: [] as never[],
  abortSignal: new AbortController().signal,
};

const validPayload: ToolDefinitionPayload = {
  name: "searchProducts",
  description: "Search products by keyword",
  parameters: [
    {
      id: "p-1",
      name: "query",
      type: "string",
      description: "Search keyword",
      required: true,
    },
    {
      id: "p-2",
      name: "limit",
      type: "number",
      description: "Max results",
      required: false,
    },
  ],
  handler: "(args) => ({ results: [], total: 0 })",
};

const noParamPayload: ToolDefinitionPayload = {
  name: "getCurrentTime",
  description: "Get current time",
  parameters: [],
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
        parameters: [],
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
        parameters: [],
        handler: "   ",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.wsHandler.execute!({}, opts);
      expect(result).toEqual({
        error: 'Tool "wsHandler" has no handler configured',
      });
    });
  });

  describe("invalid handler format", () => {
    it("returns error for unrecognized handler string", async () => {
      const payload: ToolDefinitionPayload = {
        name: "myTool",
        description: "A tool",
        parameters: [],
        handler: "nonexistent_handler",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.myTool.execute!({}, opts);
      expect(result).toEqual({
        error: "Invalid handler: must be a URL (http/https) or JS code (arrow function / function)",
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
        parameters: [],
        handler: "https://api.weather.io/v1",
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
        parameters: [],
        handler: "https://api.example.com/broken",
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
        parameters: [],
        handler: "() => ({ a: 1 })",
      };
      const payload2: ToolDefinitionPayload = {
        name: "tool2",
        description: "Second",
        parameters: [],
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
        parameters: [],
        handler: "() => ({})",
      };
      const p2: ToolDefinitionPayload = {
        name: "dup",
        description: "Second",
        parameters: [],
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
