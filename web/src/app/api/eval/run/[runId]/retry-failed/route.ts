import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { inngest } from "@/inngest/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  if (!run.agentId) {
    return Response.json({ error: "Invalid run" }, { status: 400 });
  }

  const ctx = await requireAgentRole(run.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (run.status !== "completed" && run.status !== "failed") {
    return Response.json(
      { error: "Run must be completed or failed to retry" },
      { status: 400 }
    );
  }

  // Find failed result rows (error IS NOT NULL = execution errors, not assertion failures)
  const failedResults = await db
    .select({ id: evalRunResults.id, caseId: evalRunResults.caseId })
    .from(evalRunResults)
    .where(
      and(
        eq(evalRunResults.runId, runId),
        isNotNull(evalRunResults.error),
      )
    );

  if (failedResults.length === 0) {
    return Response.json(
      { error: "No failed cases to retry" },
      { status: 400 }
    );
  }

  const failedCaseIds = failedResults.map((r) => r.caseId);

  // Delete failed result rows so they can be re-executed
  for (const result of failedResults) {
    await db
      .delete(evalRunResults)
      .where(eq(evalRunResults.id, result.id));
  }

  // Count remaining results
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(evalRunResults)
    .where(eq(evalRunResults.runId, runId));

  // Update run: status → running, completedCases → remaining count
  await db
    .update(evalRuns)
    .set({
      status: "running",
      completedCases: count,
      error: null,
    })
    .where(eq(evalRuns.id, runId));

  // Send Inngest event to re-execute failed cases
  await inngest.send({
    name: "eval/run.created",
    data: {
      runId,
      agentId: run.agentId,
      caseIds: failedCaseIds,
      userId: ctx.user.id,
    },
  });

  return Response.json({
    ok: true,
    retriedCases: failedCaseIds.length,
  });
}
