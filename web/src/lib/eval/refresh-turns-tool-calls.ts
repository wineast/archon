import { executeToolHandler } from "@/lib/tools/execute-handler";
import type { ToolContext } from "@/lib/tools/tool-context";
import type { EvalTurn, EvalTurnToolCall } from "./types";

export interface RefreshResult {
  turns: EvalTurn[];
  refreshedCount: number;
  errors: string[];
}

/**
 * Re-execute all tool calls in the given turns using the provided tool map.
 * Shared by single-case and batch refresh APIs.
 */
export async function refreshTurnsToolCalls(
  turns: EvalTurn[],
  toolMap: Map<string, { name: string; handler?: string | null; url?: string | null }>,
  toolContext: ToolContext
): Promise<RefreshResult> {
  let refreshedCount = 0;
  const errors: string[] = [];

  const updatedTurns: EvalTurn[] = await Promise.all(
    turns.map(async (turn) => {
      if (!turn.toolCalls || turn.toolCalls.length === 0) return turn;

      const updatedToolCalls: EvalTurnToolCall[] = await Promise.all(
        turn.toolCalls.map(async (tc) => {
          const toolRow = toolMap.get(tc.name);
          if (!toolRow) {
            errors.push(`Tool "${tc.name}" not found`);
            return tc;
          }

          try {
            let result: unknown;
            const url = toolRow.url?.trim();
            const handler = toolRow.handler?.trim();

            if (url) {
              const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tc.args),
              });
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
              }
              result = await res.json();
            } else if (handler) {
              result = await executeToolHandler(handler, tc.args, toolContext);
            } else {
              errors.push(`Tool "${tc.name}" has no handler or URL`);
              return tc;
            }

            refreshedCount++;
            return {
              ...tc,
              result: typeof result === "string" ? result : JSON.stringify(result),
            };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`Tool "${tc.name}" execution failed: ${msg}`);
            return tc;
          }
        })
      );

      return { ...turn, toolCalls: updatedToolCalls };
    })
  );

  return { turns: updatedTurns, refreshedCount, errors };
}
