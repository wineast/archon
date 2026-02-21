import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { avg, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import type { ModelStats } from "@/lib/eval/benchmark-types";

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
    .where(eq(evalRuns.agentId, agentId));

  // Group by chatModel
  const modelMap = new Map<
    string,
    {
      runCount: number;
      scores: number[];
      passRates: number[];
      lastRunAt: Date;
      runIds: string[];
    }
  >();

  for (const run of runs) {
    const passRate =
      run.totalCases > 0
        ? (run.passedAssertions / run.totalCases) * 100
        : 0;

    let entry = modelMap.get(run.chatModel);
    if (!entry) {
      entry = {
        runCount: 0,
        scores: [],
        passRates: [],
        lastRunAt: run.createdAt,
        runIds: [],
      };
      modelMap.set(run.chatModel, entry);
    }

    entry.runCount++;
    if (run.averageScore != null) entry.scores.push(run.averageScore);
    entry.passRates.push(passRate);
    if (run.createdAt > entry.lastRunAt) entry.lastRunAt = run.createdAt;
    entry.runIds.push(run.id);
  }

  const stats: ModelStats[] = [];

  for (const [chatModel, entry] of modelMap) {
    // Get average latency across all results for this model's runs
    let avgLatency: number | null = null;
    if (entry.runIds.length > 0) {
      // Query latency for all runs of this model
      const latencies: number[] = [];
      for (const runId of entry.runIds) {
        const [row] = await db
          .select({ avgLat: avg(evalRunResults.durationMs) })
          .from(evalRunResults)
          .where(eq(evalRunResults.runId, runId));
        if (row?.avgLat) latencies.push(Number(row.avgLat));
      }
      if (latencies.length > 0) {
        avgLatency = Math.round(
          latencies.reduce((a, b) => a + b, 0) / latencies.length
        );
      }
    }

    const avgScore =
      entry.scores.length > 0
        ? Math.round(
            (entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length) *
              10
          ) / 10
        : null;

    const avgPassRate =
      entry.passRates.length > 0
        ? Math.round(
            (entry.passRates.reduce((a, b) => a + b, 0) /
              entry.passRates.length) *
              10
          ) / 10
        : 0;

    stats.push({
      chatModel,
      runCount: entry.runCount,
      avgScore,
      avgPassRate,
      avgLatencyMs: avgLatency,
      lastRunAt: entry.lastRunAt.toISOString(),
    });
  }

  // Sort by avgScore desc (nulls last)
  stats.sort((a, b) => {
    if (a.avgScore == null && b.avgScore == null) return 0;
    if (a.avgScore == null) return 1;
    if (b.avgScore == null) return -1;
    return b.avgScore - a.avgScore;
  });

  return Response.json(stats);
}
