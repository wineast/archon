import pLimit from "p-limit";
import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { executeCase } from "./execute-case";
import { recordUsage } from "@/lib/usage/record";
import { getOrgIdByAgentId } from "@/lib/ai/get-org-id";
import type { EvalCase } from "./types";
import type { EvalRunRow } from "@/db/schema";

const DEFAULT_CONCURRENCY = 3;

export interface ExecuteEvalRunParams {
  runId: string;
  agentId: string;
  cases: EvalCase[];
  templateVars: Record<string, string>;
  toolNames: string[];
  userId: string;
}

/**
 * Server-side eval run engine.
 * Executes all cases concurrently (limited), saves results, and finalizes the run.
 * Designed to be called inside `after()` for non-blocking execution.
 */
export async function executeEvalRun(params: ExecuteEvalRunParams): Promise<void> {
  const { runId, agentId, cases, templateVars, toolNames, userId } = params;

  try {
    // Load the run record with config snapshots
    const [run] = await db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.id, runId));

    if (!run) {
      console.error(`[eval-run] Run ${runId} not found`);
      return;
    }

    const orgId = (await getOrgIdByAgentId(agentId)) ?? "";

    const limit = pLimit(run.concurrency ?? DEFAULT_CONCURRENCY);

    const tasks = cases.map((evalCase) =>
      limit(async () => {
        // Check if run has been cancelled before executing
        if (await isRunCancelled(runId)) {
          return;
        }

        await executeSingleCase({
          run,
          runId,
          evalCase,
          templateVars,
          toolNames,
          orgId,
          userId,
          agentId,
        });
      })
    );

    await Promise.allSettled(tasks);

    // Finalize the run
    await finalizeRun(runId);
  } catch (err) {
    console.error(`[eval-run] Unexpected error in run ${runId}:`, err);
    await db
      .update(evalRuns)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(evalRuns.id, runId));
  }
}

async function isRunCancelled(runId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: evalRuns.status })
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));
  return row?.status === "cancelled";
}

async function executeSingleCase(params: {
  run: EvalRunRow;
  runId: string;
  evalCase: EvalCase;
  templateVars: Record<string, string>;
  toolNames: string[];
  orgId: string;
  userId: string;
  agentId: string;
}) {
  const { run, runId, evalCase, templateVars, toolNames, orgId, userId, agentId } = params;

  const { result, chatUsage, judgeUsage } = await executeCase({
    run,
    evalCase,
    templateVars,
    toolNames,
    orgId,
  });

  // Save result to DB
  await db.insert(evalRunResults).values({
    runId,
    caseId: result.caseId,
    caseName: result.caseName,
    mode: result.mode,
    turns: result.turns,
    chatMessages: result.chatMessages,
    turnResults: result.turnResults,
    chatResponse: result.chatResponse || null,
    assertionResults: result.assertionResults,
    allAssertionsPassed: result.allAssertionsPassed,
    judgeResult: result.judgeResult,
    error: result.error ?? null,
    durationMs: result.durationMs,
  });

  // Record usage
  const chatModel = run.chatModel;
  const judgeSnapshot = run.judgeModelConfigSnapshot as { modelId: string } | null;
  const judgeModel = judgeSnapshot?.modelId ?? "";

  if (chatUsage.inputTokens > 0 || chatUsage.outputTokens > 0) {
    await recordUsage({
      orgId,
      agentId,
      userId,
      sessionId: null,
      modelId: chatModel,
      usage: chatUsage,
      source: "eval",
    });
  }
  if (judgeUsage.inputTokens > 0 || judgeUsage.outputTokens > 0) {
    await recordUsage({
      orgId,
      agentId,
      userId,
      sessionId: null,
      modelId: judgeModel,
      usage: judgeUsage,
      source: "eval",
    });
  }

  // Atomically increment completedCases
  await db
    .update(evalRuns)
    .set({
      completedCases: sql`${evalRuns.completedCases} + 1`,
    })
    .where(eq(evalRuns.id, runId));
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
