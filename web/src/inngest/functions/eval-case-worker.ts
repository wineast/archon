import { inngest } from "../client";
import { db } from "@/db";
import { evalRuns, evalRunResults, evalCases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { executeCase } from "@/lib/eval/execute-case";
import { recordUsage } from "@/lib/usage/record";
import { toEvalCase } from "@/lib/eval/types";

export const evalCaseWorker = inngest.createFunction(
  {
    id: "eval-case-worker",
    retries: 3,
  },
  { event: "eval/case.execute" },
  async ({ event, step }) => {
    const { runId, caseId, agentId, userId, orgId } = event.data as {
      runId: string;
      caseId: string;
      agentId: string;
      userId: string;
      orgId: string;
    };

    // Step 1: Check cancel status
    const cancelled = await step.run("check-cancel", async () => {
      const [row] = await db
        .select({ status: evalRuns.status })
        .from(evalRuns)
        .where(eq(evalRuns.id, runId));
      return row?.status === "cancelled";
    });

    if (cancelled) {
      return { status: "skipped" };
    }

    // Step 2: Execute the case (loads fresh data from DB to avoid serialization issues)
    const executionResult = await step.run("execute", async () => {
      const [run] = await db
        .select()
        .from(evalRuns)
        .where(eq(evalRuns.id, runId));

      if (!run) throw new Error(`Run ${runId} not found`);

      const [caseRow] = await db
        .select()
        .from(evalCases)
        .where(eq(evalCases.id, caseId));

      if (!caseRow) throw new Error(`Case ${caseId} not found`);

      const evalCase = toEvalCase(caseRow);
      const templateVars = run.templateVars as Record<string, string>;
      const toolNames = run.toolNames as string[];

      const { result, chatUsage, judgeUsage } = await executeCase({
        run,
        evalCase,
        templateVars,
        toolNames,
        orgId,
      });

      return {
        result,
        chatUsage,
        judgeUsage,
        chatModel: run.chatModel,
        judgeModel:
          (run.judgeModelConfigSnapshot as { modelId: string } | null)
            ?.modelId ?? "",
      };
    });

    // Step 3: Save result + update progress + record usage
    await step.run("save", async () => {
      const { result, chatUsage, judgeUsage, chatModel, judgeModel } =
        executionResult;

      // Upsert result (idempotent for retries)
      await db
        .insert(evalRunResults)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [evalRunResults.runId, evalRunResults.caseId],
          set: {
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
          },
        });

      // Update completedCases using COUNT (safe for retries)
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(evalRunResults)
        .where(eq(evalRunResults.runId, runId));

      await db
        .update(evalRuns)
        .set({ completedCases: count })
        .where(eq(evalRuns.id, runId));

      // Record usage
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
    });

    return { status: "completed", caseId };
  }
);
