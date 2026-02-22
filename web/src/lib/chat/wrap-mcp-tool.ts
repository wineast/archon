import type { RuntimeEventInput } from "@/lib/runtime-events/record";

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Wrap an MCP tool's execute function with timing + event collection.
 * Same pattern as wrapExecutorWithTiming in build-dynamic-tools, but
 * adds serverKey / serverId to the metadata.
 */
export function wrapMcpExecuteWithTiming(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executor: (...args: any[]) => Promise<any>,
  toolName: string,
  serverKey: string,
  serverId: string,
  agentId: string,
  collector: RuntimeEventInput[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...args: any[]) => Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...execArgs: any[]) => {
    const args = execArgs[0];
    const start = performance.now();
    try {
      const result = await executor(...execArgs);
      const durationMs = Math.round(performance.now() - start);
      const inputStr = JSON.stringify(args);
      const outputStr = JSON.stringify(result);

      const isError =
        result && typeof result === "object" && "error" in result;

      collector.push({
        agentId,
        eventType: isError ? "tool_error" : "tool_call",
        severity: isError ? "warning" : "info",
        durationMs,
        metadata: {
          toolName,
          serverKey,
          serverId,
          inputSize: inputStr.length,
          outputSize: outputStr.length,
          ...(isError
            ? { error: truncate(String((result as Record<string, unknown>).error), 500) }
            : {}),
        },
      });

      return result;
    } catch (e) {
      const durationMs = Math.round(performance.now() - start);
      const errorMsg = e instanceof Error ? e.message : String(e);
      const isTimeout =
        errorMsg.toLowerCase().includes("timeout") ||
        errorMsg.toLowerCase().includes("timed out");

      collector.push({
        agentId,
        eventType: isTimeout ? "tool_timeout" : "tool_error",
        severity: "error",
        durationMs,
        metadata: {
          toolName,
          serverKey,
          serverId,
          inputSize: JSON.stringify(args).length,
          error: truncate(errorMsg, 500),
        },
      });

      throw e;
    }
  };
}
