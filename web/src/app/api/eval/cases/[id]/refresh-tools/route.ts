import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalCases, tools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { createToolContext } from "@/lib/tools/tool-context";
import { refreshTurnsToolCalls } from "@/lib/eval/refresh-turns-tool-calls";
import type { EvalTurn } from "@/lib/eval/types";

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
  const result = await refreshTurnsToolCalls(turns, toolMap, toolContext);

  return NextResponse.json(result);
}
