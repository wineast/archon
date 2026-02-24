import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { RunCaseRequest, RunCaseResponse } from "@/lib/eval/types";
import { executeCase } from "@/lib/eval/execute-case";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { recordUsage } from "@/lib/usage/record";
import { getOrgIdByAgentId } from "@/lib/ai/get-org-id";
import { QuotaExceededError } from "@/lib/credits/errors";

export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const body: RunCaseRequest = await req.json();
  const {
    case: evalCase,
    templateVars = {},
    toolNames = [],
  } = body;

  // Verify run exists
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));

  if (!run || !run.agentId) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(run.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const orgId = await getOrgIdByAgentId(run.agentId);

  try {
    const { result, chatUsage, judgeUsage } = await executeCase({
      run,
      evalCase,
      templateVars,
      toolNames,
      orgId: orgId ?? "",
    });

    // Record usage (chat model + judge model separately)
    const chatModel = run.chatModel;
    const judgeSnapshot = run.judgeModelConfigSnapshot as { modelId: string } | null;
    const judgeModel = judgeSnapshot?.modelId ?? "";

    if (chatUsage.inputTokens > 0 || chatUsage.outputTokens > 0) {
      await recordUsage({
        orgId,
        agentId: run.agentId,
        userId: ctx.user.id,
        sessionId: null,
        modelId: chatModel,
        usage: chatUsage,
        source: "eval",
      });
    }
    if (judgeUsage.inputTokens > 0 || judgeUsage.outputTokens > 0) {
      await recordUsage({
        orgId,
        agentId: run.agentId,
        userId: ctx.user.id,
        sessionId: null,
        modelId: judgeModel,
        usage: judgeUsage,
        source: "eval",
      });
    }

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

    return Response.json({ result } satisfies RunCaseResponse);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return Response.json({ error: "quota_exceeded", message: err.message }, { status: 402 });
    }
    throw err;
  }
}
