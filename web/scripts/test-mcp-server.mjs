/**
 * 本地测试用 MCP Server（Streamable HTTP）
 * 启动：node web/scripts/test-mcp-server.mjs
 * URL：http://localhost:18923/mcp
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import http from "node:http";

function registerTools(server) {
  server.tool(
    "greet",
    "Say hello to someone",
    { name: z.string().describe("Person's name") },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}! 👋` }],
    })
  );

  server.tool(
    "add",
    "Add two numbers together",
    {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: `${a} + ${b} = ${a + b}` }],
    })
  );

  server.tool(
    "get_weather",
    "Get fake weather for a city",
    {
      city: z.string().describe("City name"),
      unit: z.enum(["celsius", "fahrenheit"]).describe("Temperature unit"),
    },
    async ({ city, unit }) => {
      const temp = Math.round(Math.random() * 35 + 5);
      const display = unit === "fahrenheit" ? `${Math.round(temp * 1.8 + 32)}°F` : `${temp}°C`;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ city, temperature: display, condition: "Partly cloudy", humidity: "65%" }),
          },
        ],
      };
    }
  );

  server.tool(
    "search",
    "Search with filters (complex params demo)",
    {
      query: z.string().describe("Search query"),
      filters: z
        .object({
          category: z.string().optional(),
          maxResults: z.number().optional(),
        })
        .optional()
        .describe("Optional filters (JSON object)"),
      verbose: z.boolean().optional().describe("Include debug info"),
    },
    async ({ query, filters, verbose }) => {
      const results = [
        { title: `Result 1 for "${query}"`, score: 0.95 },
        { title: `Result 2 for "${query}"`, score: 0.87 },
        { title: `Result 3 for "${query}"`, score: 0.72 },
      ];
      const sliced = filters?.maxResults ? results.slice(0, filters.maxResults) : results;
      const response = { query, results: sliced, total: sliced.length };
      if (verbose) response.debug = { filters, timestamp: new Date().toISOString() };
      return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
    }
  );
}

// --- HTTP Server ---
const PORT = 18923;
const transports = new Map();

const httpServer = http.createServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  // Handle GET for SSE stream
  if (req.method === "GET") {
    const sessionId = req.headers["mcp-session-id"];
    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(400);
      res.end("No session");
      return;
    }
    await transport.handleRequest(req, res);
    return;
  }

  // Handle DELETE for session cleanup
  if (req.method === "DELETE") {
    const sessionId = req.headers["mcp-session-id"];
    const transport = transports.get(sessionId);
    if (transport) {
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
    } else {
      res.writeHead(200);
      res.end();
    }
    return;
  }

  // Handle POST
  if (req.method === "POST") {
    const sessionId = req.headers["mcp-session-id"];
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
      return;
    }

    // New session — each session gets its own McpServer instance
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
    const server = new McpServer({ name: "test-mcp-server", version: "1.0.0" });
    registerTools(server);
    await server.connect(transport);

    transport.onclose = () => {
      const sid = [...transports.entries()].find(([, t]) => t === transport)?.[0];
      if (sid) transports.delete(sid);
    };

    await transport.handleRequest(req, res);

    // Store transport using its session ID (set by transport during initialize)
    const sid = transport.sessionId;
    if (sid) transports.set(sid, transport);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

// Listen on 0.0.0.0 to accept both IPv4 and IPv6 via dual-stack
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Test MCP Server running at http://localhost:${PORT}/mcp`);
  console.log(`   Transport: Streamable HTTP`);
  console.log(`   Tools: greet, add, get_weather, search`);
  console.log(`\n   Press Ctrl+C to stop.`);
});
