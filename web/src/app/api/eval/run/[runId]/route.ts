import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { FinalizeRunResponse } from "@/lib/eval/types";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

/** Finalize a run: aggregate results from evalRunResults into the evalRuns record */
export async function PATCH(
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

  const ctx = await requireAgentRole(run.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Load all results for this run
  const results = await db
    .select()
    .from(evalRunResults)
    .where(eq(evalRunResults.runId, runId));

  const totalCases = results.length;
  const passedAssertions = results.filter((r) => r.allAssertionsPassed).length;

  type JudgeResultType = { overallScore?: number } | null;
  const scores = results
    .map((r) => (r.judgeResult as JudgeResultType)?.overallScore)
    .filter((s): s is number => s != null);

  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  // If the run was still in "running" state (e.g. single-case run via CaseDetail),
  // mark it as completed during finalize
  const statusUpdate = run.status === "running" ? "completed" as const : undefined;

  await db
    .update(evalRuns)
    .set({
      totalCases,
      passedAssertions,
      averageScore,
      ...(statusUpdate ? { status: statusUpdate } : {}),
    })
    .where(eq(evalRuns.id, runId));

  return Response.json({
    passedAssertions,
    averageScore,
    totalCases,
  } satisfies FinalizeRunResponse);
}
