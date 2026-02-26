import { db } from "@/db";
import { evalBatches } from "@/db/schema";
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

  const batches = await db
    .select()
    .from(evalBatches)
    .where(eq(evalBatches.agentId, agentId))
    .orderBy(desc(evalBatches.createdAt));

  // Auto-fail batches that have been running for over 30 minutes
  const cutoff = new Date(Date.now() - TIMEOUT_MS);
  const staleBatches = batches.filter(
    (b) => b.status === "running" && new Date(b.createdAt) < cutoff
  );

  if (staleBatches.length > 0) {
    await Promise.all(
      staleBatches.map((b) =>
        db
          .update(evalBatches)
          .set({ status: "failed", error: "Batch timed out (30 min)" })
          .where(
            and(
              eq(evalBatches.id, b.id),
              eq(evalBatches.status, "running"),
              lt(evalBatches.createdAt, cutoff),
            )
          )
      )
    );

    for (const stale of staleBatches) {
      const idx = batches.findIndex((b) => b.id === stale.id);
      if (idx >= 0) {
        batches[idx] = { ...batches[idx], status: "failed", error: "Batch timed out (30 min)" };
      }
    }
  }

  return Response.json(batches);
}
