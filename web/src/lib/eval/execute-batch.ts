import { db } from "@/db";
import { evalBatches, evalRuns } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function isBatchCancelled(batchId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: evalBatches.status })
    .from(evalBatches)
    .where(eq(evalBatches.id, batchId));
  return row?.status === "cancelled";
}

/**
 * Finalize a batch: aggregate stats from all runs and update batch status.
 */
export async function finalizeBatch(batchId: string): Promise<void> {
  // 1. Read batch current state
  const [batch] = await db
    .select()
    .from(evalBatches)
    .where(eq(evalBatches.id, batchId));

  if (!batch) return;

  // 2. Load all runs for this batch (each already finalized by run-orchestrator)
  const runs = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.batchId, batchId));

  if (runs.length === 0) {
    const finalStatus = batch.status === "cancelled" ? "cancelled" : "completed";
    await db
      .update(evalBatches)
      .set({ status: finalStatus })
      .where(eq(evalBatches.id, batchId));
    return;
  }

  // 3. Aggregate
  const totalPassedAssertions = runs.reduce((sum, r) => sum + r.passedAssertions, 0);

  const scores = runs
    .map((r) => r.averageScore)
    .filter((s): s is number => s != null);

  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  let scoreStdDev: number | null = null;
  let minScore: number | null = null;
  let maxScore: number | null = null;

  if (scores.length > 1) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    scoreStdDev = Math.round(Math.sqrt(variance) * 100) / 100;
    minScore = Math.min(...scores);
    maxScore = Math.max(...scores);
  } else if (scores.length === 1) {
    minScore = scores[0];
    maxScore = scores[0];
  }

  // 4. Determine status
  const hasAnyFailed = runs.some((r) => r.status === "failed");
  const finalStatus =
    batch.status === "cancelled"
      ? "cancelled"
      : hasAnyFailed
        ? "failed"
        : "completed";

  // 5. Update batch
  await db
    .update(evalBatches)
    .set({
      passedAssertions: totalPassedAssertions,
      averageScore,
      scoreStdDev,
      minScore,
      maxScore,
      status: finalStatus,
    })
    .where(eq(evalBatches.id, batchId));
}
