import { inngest } from "../client";
import { db } from "@/db";
import { evalBatches, evalRuns } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { isBatchCancelled, finalizeBatch } from "@/lib/eval/execute-batch";
import { evalOrchestrator } from "./eval-orchestrator";

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export const evalBatchOrchestrator = inngest.createFunction(
  {
    id: "eval-batch-orchestrator",
    retries: 0,
  },
  { event: "eval/batch.created" },
  async ({ event, step }) => {
    const { batchId, agentId, runConfigs, userId } = event.data as {
      batchId: string;
      agentId: string;
      runConfigs: Array<{ runId: string; caseIds: string[] }>;
      userId: string;
    };

    // Step 1: Load config
    const { runConcurrency } = await step.run("load-config", async () => {
      const [batch] = await db
        .select({ runConcurrency: evalBatches.runConcurrency })
        .from(evalBatches)
        .where(eq(evalBatches.id, batchId));

      if (!batch) throw new Error(`Batch ${batchId} not found`);

      return { runConcurrency: batch.runConcurrency ?? 1 };
    });

    // Step 2: Process runs in batches by runConcurrency
    const runBatches = chunk(runConfigs, runConcurrency);

    for (let batchIdx = 0; batchIdx < runBatches.length; batchIdx++) {
      const runBatch = runBatches[batchIdx];

      // Check cancel before each batch of runs
      const cancelled = await step.run(
        `check-cancel-${batchIdx}`,
        async () => {
          return await isBatchCancelled(batchId);
        }
      );

      if (cancelled) break;

      // Set runs in this batch to "running"
      const runIds = runBatch.map((r) => r.runId);
      await step.run(`set-running-${batchIdx}`, async () => {
        await db
          .update(evalRuns)
          .set({ status: "running" })
          .where(
            and(
              inArray(evalRuns.id, runIds),
              eq(evalRuns.status, "pending")
            )
          );
      });

      // Invoke run orchestrators in parallel
      await Promise.all(
        runBatch.map((rc) =>
          step.invoke(`run-${rc.runId}`, {
            function: evalOrchestrator,
            data: {
              runId: rc.runId,
              agentId,
              caseIds: rc.caseIds,
              userId,
            },
          })
        )
      );

      // Update completedRuns
      await step.run(`update-progress-${batchIdx}`, async () => {
        const completedSoFar = (batchIdx + 1) * runConcurrency;
        const capped = Math.min(completedSoFar, runConfigs.length);
        await db
          .update(evalBatches)
          .set({ completedRuns: capped })
          .where(eq(evalBatches.id, batchId));
      });
    }

    // Step 3: Finalize batch
    await step.run("finalize-batch", async () => {
      await finalizeBatch(batchId);
    });

    return { status: "done", batchId };
  }
);
