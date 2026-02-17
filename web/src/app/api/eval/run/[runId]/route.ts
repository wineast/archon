import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { FinalizeRunResponse } from "@/lib/eval/types";

/** Finalize a run: aggregate results from evalRunResults into the evalRuns record */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

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

  await db
    .update(evalRuns)
    .set({ totalCases, passedAssertions, averageScore })
    .where(eq(evalRuns.id, runId));

  return Response.json({
    passedAssertions,
    averageScore,
    totalCases,
  } satisfies FinalizeRunResponse);
}
