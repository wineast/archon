import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { asc, avg, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import type { TrendPoint } from "@/lib/eval/benchmark-types";
import type { Dimension } from "@/lib/eval/types";
import { getScoreMax } from "@/lib/eval/judge-dimensions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const runs = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.agentId, agentId))
    .orderBy(asc(evalRuns.createdAt))
    .limit(50);

  const points: TrendPoint[] = [];

  for (const run of runs) {
    const [latencyRow] = await db
      .select({ avgLatency: avg(evalRunResults.durationMs) })
      .from(evalRunResults)
      .where(eq(evalRunResults.runId, run.id));

    const passRate =
      run.totalCases > 0
        ? (run.passedAssertions / run.totalCases) * 100
        : 0;

    const dimensions = (run.judgeConfigSnapshot as { dimensions?: Dimension[] } | null)?.dimensions;
    points.push({
      runId: run.id,
      createdAt: run.createdAt.toISOString(),
      chatModel: run.chatModel,
      averageScore: run.averageScore,
      passRate: Math.round(passRate * 10) / 10,
      averageLatencyMs: latencyRow?.avgLatency
        ? Math.round(Number(latencyRow.avgLatency))
        : null,
      totalCases: run.totalCases,
      isBaseline: run.isBaseline,
      scoreMax: getScoreMax(dimensions),
    });
  }

  return Response.json(points);
}
