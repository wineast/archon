import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDynamicTools } from "@/app/api/chat/tools/build-dynamic-tools";
import type { ToolDefinitionPayload } from "../types";
import type { TemplateData } from "@/lib/template/render";

vi.mock("@/lib/template/render", () => ({
  renderTemplate: vi.fn(async (text: string) => text),
}));

import { renderTemplate } from "@/lib/template/render";
const mockRenderTemplate = vi.mocked(renderTemplate);

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
  output: JSON.stringify({ results: [], total: 0 }),
  handler: "",
};

const noParamPayload: ToolDefinitionPayload = {
  name: "getCurrentTime",
  description: "Get current time",
  parameters: [],
  output: JSON.stringify({ time: "12:00" }),
  handler: "",
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

  describe("static output (no handler)", () => {
    it("returns parsed JSON object", async () => {
      const tools = buildDynamicTools([validPayload]);
      const result = await tools.searchProducts.execute!(
        { query: "test" },
        opts
      );
      expect(result).toEqual({ results: [], total: 0 });
    });

    it("works for no-param tool", async () => {
      const tools = buildDynamicTools([noParamPayload]);
      const result = await tools.getCurrentTime.execute!({}, opts);
      expect(result).toEqual({ time: "12:00" });
    });

    it("falls back to { result: rawString } for invalid JSON", async () => {
      const payload: ToolDefinitionPayload = {
        name: "broken",
        description: "Tool with invalid JSON output",
        parameters: [],
        output: "not valid json",
        handler: "",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.broken.execute!({}, opts);
      expect(result).toEqual({ result: "not valid json" });
    });

    it("falls back for empty string", async () => {
      const payload: ToolDefinitionPayload = {
        name: "empty",
        description: "Empty output",
        parameters: [],
        output: "",
        handler: "",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.empty.execute!({}, opts);
      expect(result).toEqual({ result: "" });
    });
  });

  describe("local handler", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("returns error when handler key not found in registry", async () => {
      const payload: ToolDefinitionPayload = {
        name: "myTool",
        description: "A tool",
        parameters: [],
        output: "{}",
        handler: "nonexistent_handler",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.myTool.execute!({}, opts);
      expect(result).toEqual({
        error: 'Handler "nonexistent_handler" not found in registry',
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
        output: "",
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
        output: "",
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
        output: '{"a":1}',
        handler: "",
      };
      const payload2: ToolDefinitionPayload = {
        name: "tool2",
        description: "Second",
        parameters: [],
        output: '{"b":2}',
        handler: "",
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
        output: "{}",
        handler: "",
      };
      const p2: ToolDefinitionPayload = {
        name: "dup",
        description: "Second",
        parameters: [],
        output: "{}",
        handler: "",
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

  describe("static output with template rendering", () => {
    const templateData: TemplateData = {
      resolvedVars: { greeting: "hello" },
      docs: [],
      datasetEntries: {
        colors: [
          { value: "red" },
          { value: "blue" },
        ],
      },
      toolRows: [],
    };

    beforeEach(() => {
      mockRenderTemplate.mockReset();
    });

    it("renders template variables in output JSON", async () => {
      mockRenderTemplate.mockResolvedValue('{"msg": "hello world"}');

      const payload: ToolDefinitionPayload = {
        name: "greet",
        description: "Greet",
        parameters: [],
        output: '{"msg": "{{greeting}} world"}',
        handler: "",
      };
      const tools = buildDynamicTools([payload], templateData);
      const result = await tools.greet.execute!({}, opts);

      expect(mockRenderTemplate).toHaveBeenCalledWith(
        '{"msg": "{{greeting}} world"}',
        templateData
      );
      expect(result).toEqual({ msg: "hello world" });
    });

    it("renders lookup table references in output", async () => {
      mockRenderTemplate.mockResolvedValue(
        '{"colors": ["red", "blue"]}'
      );

      const payload: ToolDefinitionPayload = {
        name: "getColors",
        description: "Get colors",
        parameters: [],
        output: '{"colors": "{{colors}}"}',
        handler: "",
      };
      const tools = buildDynamicTools([payload], templateData);
      const result = await tools.getColors.execute!({}, opts);

      expect(mockRenderTemplate).toHaveBeenCalledWith(
        '{"colors": "{{colors}}"}',
        templateData
      );
      expect(result).toEqual({ colors: ["red", "blue"] });
    });

    it("plain JSON without template vars works with templateData", async () => {
      mockRenderTemplate.mockResolvedValue('{"status": "ok"}');

      const payload: ToolDefinitionPayload = {
        name: "status",
        description: "Status",
        parameters: [],
        output: '{"status": "ok"}',
        handler: "",
      };
      const tools = buildDynamicTools([payload], templateData);
      const result = await tools.status.execute!({}, opts);

      expect(result).toEqual({ status: "ok" });
    });

    it("falls back to { result: string } if rendered output is not valid JSON", async () => {
      mockRenderTemplate.mockResolvedValue("hello world");

      const payload: ToolDefinitionPayload = {
        name: "text",
        description: "Text output",
        parameters: [],
        output: "{{greeting}} world",
        handler: "",
      };
      const tools = buildDynamicTools([payload], templateData);
      const result = await tools.text.execute!({}, opts);

      expect(result).toEqual({ result: "hello world" });
    });

    it("does not call renderTemplate when no templateData provided", async () => {
      const payload: ToolDefinitionPayload = {
        name: "noTemplate",
        description: "No template",
        parameters: [],
        output: '{"a": 1}',
        handler: "",
      };
      const tools = buildDynamicTools([payload]);
      const result = await tools.noTemplate.execute!({}, opts);

      expect(mockRenderTemplate).not.toHaveBeenCalled();
      expect(result).toEqual({ a: 1 });
    });
  });
});
