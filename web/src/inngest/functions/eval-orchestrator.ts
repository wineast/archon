import { inngest } from "../client";
import { db } from "@/db";
import { evalRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { finalizeRun, isRunCancelled } from "@/lib/eval/execute-run";
import { getOrgIdByAgentId } from "@/lib/ai/get-org-id";
import { evalCaseWorker } from "./eval-case-worker";

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export const evalOrchestrator = inngest.createFunction(
  {
    id: "eval-orchestrator",
    retries: 0,
  },
  { event: "eval/run.created" },
  async ({ event, step }) => {
    const { runId, agentId, caseIds, userId } = event.data as {
      runId: string;
      agentId: string;
      caseIds: string[];
      userId: string;
    };

    // Step 1: Load config
    const { concurrency, orgId } = await step.run("load-config", async () => {
      const [run] = await db
        .select({ concurrency: evalRuns.concurrency })
        .from(evalRuns)
        .where(eq(evalRuns.id, runId));

      if (!run) throw new Error(`Run ${runId} not found`);

      const resolvedOrgId = (await getOrgIdByAgentId(agentId)) ?? "";

      return { concurrency: run.concurrency ?? 3, orgId: resolvedOrgId };
    });

    // Step 2: Process cases in batches
    const batches = chunk(caseIds, concurrency);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      // Check cancel before each batch
      const cancelled = await step.run(
        `check-cancel-${batchIdx}`,
        async () => {
          return await isRunCancelled(runId);
        }
      );

      if (cancelled) break;

      // Execute batch in parallel using step.invoke
      await Promise.all(
        batch.map((caseId) =>
          step.invoke(`case-${caseId}`, {
            function: evalCaseWorker,
            data: {
              runId,
              caseId,
              agentId,
              userId,
              orgId,
            },
          })
        )
      );
    }

    // Step 3: Finalize
    await step.run("finalize", async () => {
      await finalizeRun(runId);
    });

    return { status: "done", runId };
  }
);
