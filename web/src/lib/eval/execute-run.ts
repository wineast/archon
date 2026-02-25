import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function isRunCancelled(runId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: evalRuns.status })
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));
  return row?.status === "cancelled";
}

/**
 * Finalize a run: aggregate results and update status.
 * Re-checks status to handle cancel during execution.
 */
export async function finalizeRun(runId: string): Promise<void> {
  // Re-check current status
  const [currentRun] = await db
    .select({ status: evalRuns.status })
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));

  if (!currentRun) return;

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

  // Determine final status
  const finalStatus = currentRun.status === "cancelled" ? "cancelled" : "completed";

  await db
    .update(evalRuns)
    .set({ totalCases, passedAssertions, averageScore, status: finalStatus })
    .where(eq(evalRuns.id, runId));
}
