import { db } from "@/db";
import { evalRuns } from "@/db/schema";
import { desc, eq, and, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const runs = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.agentId, agentId))
    .orderBy(desc(evalRuns.createdAt));

  // Auto-fail runs that have been running for over 30 minutes
  const cutoff = new Date(Date.now() - TIMEOUT_MS);
  const staleRuns = runs.filter(
    (r) => r.status === "running" && new Date(r.createdAt) < cutoff
  );

  if (staleRuns.length > 0) {
    await Promise.all(
      staleRuns.map((r) =>
        db
          .update(evalRuns)
          .set({ status: "failed", error: "Run timed out (30 min)" })
          .where(
            and(
              eq(evalRuns.id, r.id),
              eq(evalRuns.status, "running"),
              lt(evalRuns.createdAt, cutoff),
            )
          )
      )
    );

    // Update the stale runs in the response
    for (const stale of staleRuns) {
      const idx = runs.findIndex((r) => r.id === stale.id);
      if (idx >= 0) {
        runs[idx] = { ...runs[idx], status: "failed", error: "Run timed out (30 min)" };
      }
    }
  }

  return Response.json(runs);
}
