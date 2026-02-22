import { describe, it, expect } from "vitest";
import { wrapMcpExecuteWithTiming } from "../wrap-mcp-tool";
import type { RuntimeEventInput } from "@/lib/runtime-events/record";

const SERVER_KEY = "weather_api";
const SERVER_ID = "srv-001";
const AGENT_ID = "agent-001";
const TOOL_NAME = "mcp_weather_api__get_forecast";

describe("wrapMcpExecuteWithTiming", () => {
  it("records tool_call on success", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async (args: unknown) => ({ temp: 72 });
    const wrapped = wrapMcpExecuteWithTiming(
      executor, TOOL_NAME, SERVER_KEY, SERVER_ID, AGENT_ID, collector,
    );

    const result = await wrapped({ city: "NYC" });

    expect(result).toEqual({ temp: 72 });
    expect(collector).toHaveLength(1);
    const evt = collector[0];
    expect(evt.eventType).toBe("tool_call");
    expect(evt.severity).toBe("info");
    expect(evt.durationMs).toBeGreaterThanOrEqual(0);
    expect(evt.metadata).toMatchObject({
      toolName: TOOL_NAME,
      serverKey: SERVER_KEY,
      serverId: SERVER_ID,
    });
    expect(evt.metadata!.inputSize).toBeGreaterThan(0);
    expect(evt.metadata!.outputSize).toBeGreaterThan(0);
  });

  it("records tool_error when result contains error field", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => ({ error: "API rate limited" });
    const wrapped = wrapMcpExecuteWithTiming(
      executor, TOOL_NAME, SERVER_KEY, SERVER_ID, AGENT_ID, collector,
    );

    const result = await wrapped({});

    expect(result).toEqual({ error: "API rate limited" });
    expect(collector).toHaveLength(1);
    expect(collector[0].eventType).toBe("tool_error");
    expect(collector[0].severity).toBe("warning");
    expect(collector[0].metadata!.error).toBe("API rate limited");
  });

  it("records tool_error when executor throws", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => { throw new Error("connection refused"); };
    const wrapped = wrapMcpExecuteWithTiming(
      executor, TOOL_NAME, SERVER_KEY, SERVER_ID, AGENT_ID, collector,
    );

    await expect(wrapped({ q: "test" })).rejects.toThrow("connection refused");
    expect(collector).toHaveLength(1);
    expect(collector[0].eventType).toBe("tool_error");
    expect(collector[0].severity).toBe("error");
    expect(collector[0].metadata!.error).toBe("connection refused");
    expect(collector[0].metadata!.serverKey).toBe(SERVER_KEY);
    expect(collector[0].metadata!.serverId).toBe(SERVER_ID);
  });

  it("records tool_timeout when error message contains timeout", async () => {
    const collector: RuntimeEventInput[] = [];
    const executor = async () => { throw new Error("Request timed out after 30s"); };
    const wrapped = wrapMcpExecuteWithTiming(
      executor, TOOL_NAME, SERVER_KEY, SERVER_ID, AGENT_ID, collector,
    );

    await expect(wrapped({})).rejects.toThrow("timed out");
    expect(collector).toHaveLength(1);
    expect(collector[0].eventType).toBe("tool_timeout");
    expect(collector[0].severity).toBe("error");
  });

  it("passes all arguments to original executor", async () => {
    const collector: RuntimeEventInput[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let receivedArgs: any[] = [];
    const executor = async (...args: unknown[]) => {
      receivedArgs = args as any[];
      return { ok: true };
    };
    const wrapped = wrapMcpExecuteWithTiming(
      executor, TOOL_NAME, SERVER_KEY, SERVER_ID, AGENT_ID, collector,
    );

    const opts = { toolCallId: "tc1" };
    await wrapped({ city: "LA" }, opts);

    expect(receivedArgs).toHaveLength(2);
    expect(receivedArgs[0]).toEqual({ city: "LA" });
    expect(receivedArgs[1]).toEqual(opts);
  });

  it("truncates long error messages to 500 chars", async () => {
    const collector: RuntimeEventInput[] = [];
    const longMsg = "x".repeat(1000);
    const executor = async () => { throw new Error(longMsg); };
    const wrapped = wrapMcpExecuteWithTiming(
      executor, TOOL_NAME, SERVER_KEY, SERVER_ID, AGENT_ID, collector,
    );

    await expect(wrapped({})).rejects.toThrow();
    expect((collector[0].metadata!.error as string).length).toBeLessThanOrEqual(501); // 500 + "…"
  });
});
