import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalCases, tools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { createToolContext } from "@/lib/tools/tool-context";
import { refreshTurnsToolCalls } from "@/lib/eval/refresh-turns-tool-calls";
import type { EvalTurn } from "@/lib/eval/types";

/**
 * POST /api/eval/cases/refresh-tools?agentId=xxx
 *
 * Batch re-execute all tool calls across all eval cases for the given agent.
 * Unlike single-case refresh, this saves results directly to the database.
 */
export async function POST(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = await resolveEditingVersionId(agentId);

  // Load all cases for this agent/version
  const allCases = await db
    .select()
    .from(evalCases)
    .where(
      and(
        eq(evalCases.agentId, agentId),
        eq(evalCases.versionId, versionId),
        isNull(evalCases.deletedAt)
      )
    );

  // Load tools once — shared across all cases
  const toolRows = await db
    .select()
    .from(tools)
    .where(and(eq(tools.versionId, versionId), isNull(tools.deletedAt)));

  const toolMap = new Map(toolRows.map((t) => [t.name, t]));
  const toolContext = createToolContext(agentId, versionId);

  let casesRefreshed = 0;
  let totalToolCalls = 0;
  const errors: string[] = [];

  // Process each case that has tool calls
  for (const evalCase of allCases) {
    try {
      const turns: EvalTurn[] = evalCase.turns ?? [];
      const hasToolCalls = turns.some(
        (t) => t.toolCalls && t.toolCalls.length > 0
      );
      if (!hasToolCalls) continue;

      const result = await refreshTurnsToolCalls(turns, toolMap, toolContext);

      if (result.refreshedCount > 0) {
        await db
          .update(evalCases)
          .set({ turns: result.turns })
          .where(eq(evalCases.id, evalCase.id));
        casesRefreshed++;
        totalToolCalls += result.refreshedCount;
      }

      errors.push(...result.errors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Case "${evalCase.name}" failed: ${msg}`);
    }
  }

  return NextResponse.json({ casesRefreshed, totalToolCalls, errors });
}
