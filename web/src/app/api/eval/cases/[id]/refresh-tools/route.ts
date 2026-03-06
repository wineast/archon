import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalCases, tools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { executeToolHandler } from "@/lib/tools/execute-handler";
import { createToolContext } from "@/lib/tools/tool-context";
import type { EvalTurn, EvalTurnToolCall } from "@/lib/eval/types";

/**
 * POST /api/eval/cases/[id]/refresh-tools
 *
 * Re-execute all tool calls in the case's turns using current tool handlers.
 * Returns refreshed turns without saving — the client decides whether to save.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(evalCases)
    .where(and(eq(evalCases.id, id), isNull(evalCases.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = existing.versionId!;
  const agentId = existing.agentId!;

  // Load all enabled tools for this version
  const toolRows = await db
    .select()
    .from(tools)
    .where(and(eq(tools.versionId, versionId), isNull(tools.deletedAt)));

  const toolMap = new Map(toolRows.map((t) => [t.name, t]));
  const toolContext = createToolContext(agentId, versionId);

  const turns: EvalTurn[] = existing.turns ?? [];
  let refreshedCount = 0;
  const errors: string[] = [];

  // Process each turn, re-executing tool calls
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

          // Execute via URL or handler
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

  return NextResponse.json({
    turns: updatedTurns,
    refreshedCount,
    errors,
  });
}
