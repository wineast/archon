import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import type {
  CaseComparison,
  CompareResponse,
  CompareRunMeta,
  CompareSummary,
} from "@/lib/eval/benchmark-types";
import type { JudgeResult } from "@/lib/eval/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runAId = url.searchParams.get("runA");
  const runBId = url.searchParams.get("runB");

  if (!runAId || !runBId) {
    return NextResponse.json(
      { error: "runA and runB are required" },
      { status: 400 }
    );
  }

  // Load both runs
  const [runA] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, runAId));
  const [runB] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, runBId));

  if (!runA || !runB) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(runA.agentId!, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const resultsA = await db
    .select()
    .from(evalRunResults)
    .where(eq(evalRunResults.runId, runAId));
  const resultsB = await db
    .select()
    .from(evalRunResults)
    .where(eq(evalRunResults.runId, runBId));

  // Build case maps
  const mapA = new Map(resultsA.map((r) => [r.caseId, r]));
  const mapB = new Map(resultsB.map((r) => [r.caseId, r]));

  const allCaseIds = new Set([...mapA.keys(), ...mapB.keys()]);

  const cases: CaseComparison[] = [];
  for (const caseId of allCaseIds) {
    const a = mapA.get(caseId);
    const b = mapB.get(caseId);

    const scoreA = (a?.judgeResult as JudgeResult | null)?.overallScore ?? null;
    const scoreB = (b?.judgeResult as JudgeResult | null)?.overallScore ?? null;

    cases.push({
      caseId,
      caseName: a?.caseName ?? b?.caseName ?? caseId,
      resultA: a
        ? {
            score: scoreA,
            passed: a.allAssertionsPassed,
            latencyMs: a.durationMs,
          }
        : null,
      resultB: b
        ? {
            score: scoreB,
            passed: b.allAssertionsPassed,
            latencyMs: b.durationMs,
          }
        : null,
      scoreDelta:
        scoreA != null && scoreB != null ? scoreB - scoreA : null,
      latencyDelta:
        a && b ? b.durationMs - a.durationMs : null,
      passedChanged:
        a != null && b != null
          ? a.allAssertionsPassed !== b.allAssertionsPassed
          : false,
    });
  }

  // Summary
  const scoresA = resultsA
    .map((r) => (r.judgeResult as JudgeResult | null)?.overallScore)
    .filter((s): s is number => s != null);
  const scoresB = resultsB
    .map((r) => (r.judgeResult as JudgeResult | null)?.overallScore)
    .filter((s): s is number => s != null);

  const avgA =
    scoresA.length > 0
      ? scoresA.reduce((a, b) => a + b, 0) / scoresA.length
      : null;
  const avgB =
    scoresB.length > 0
      ? scoresB.reduce((a, b) => a + b, 0) / scoresB.length
      : null;

  const passRateA =
    resultsA.length > 0
      ? (resultsA.filter((r) => r.allAssertionsPassed).length /
          resultsA.length) *
        100
      : 0;
  const passRateB =
    resultsB.length > 0
      ? (resultsB.filter((r) => r.allAssertionsPassed).length /
          resultsB.length) *
        100
      : 0;

  const latenciesA = resultsA.map((r) => r.durationMs);
  const latenciesB = resultsB.map((r) => r.durationMs);
  const latAvgA =
    latenciesA.length > 0
      ? Math.round(
          latenciesA.reduce((a, b) => a + b, 0) / latenciesA.length
        )
      : null;
  const latAvgB =
    latenciesB.length > 0
      ? Math.round(
          latenciesB.reduce((a, b) => a + b, 0) / latenciesB.length
        )
      : null;

  let winner: "A" | "B" | "tie" = "tie";
  if (avgA != null && avgB != null) {
    if (avgB > avgA) winner = "B";
    else if (avgA > avgB) winner = "A";
  }

  const summary: CompareSummary = {
    scoreAvgA: avgA != null ? Math.round(avgA * 10) / 10 : null,
    scoreAvgB: avgB != null ? Math.round(avgB * 10) / 10 : null,
    passRateA: Math.round(passRateA * 10) / 10,
    passRateB: Math.round(passRateB * 10) / 10,
    latencyAvgA: latAvgA,
    latencyAvgB: latAvgB,
    winner,
  };

  const toMeta = (
    run: typeof runA
  ): CompareRunMeta => ({
    id: run.id,
    chatModel: run.chatModel,
    createdAt: run.createdAt.toISOString(),
    totalCases: run.totalCases,
  });

  const response: CompareResponse = {
    runA: toMeta(runA),
    runB: toMeta(runB),
    cases,
    summary,
  };

  return Response.json(response);
}
