import { db } from "@/db";
import { evalBatches, evalRuns } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const [batch] = await db
    .select()
    .from(evalBatches)
    .where(eq(evalBatches.id, batchId));

  if (!batch) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }

  if (!batch.agentId) {
    return Response.json({ error: "Invalid batch" }, { status: 400 });
  }

  const ctx = await requireAgentRole(batch.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (batch.status !== "running") {
    return Response.json(
      { error: "Batch is not in running state" },
      { status: 400 }
    );
  }

  // Cancel the batch
  await db
    .update(evalBatches)
    .set({ status: "cancelled" })
    .where(eq(evalBatches.id, batchId));

  // Cancel all pending/running runs
  await db
    .update(evalRuns)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(evalRuns.batchId, batchId),
        inArray(evalRuns.status, ["pending", "running"])
      )
    );

  return Response.json({ ok: true });
}
