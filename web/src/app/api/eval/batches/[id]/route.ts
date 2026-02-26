import { db } from "@/db";
import { evalBatches, evalRuns } from "@/db/schema";
import { and, eq, ne, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import type { EvalBatchDetail } from "@/lib/eval/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [batch] = await db
    .select()
    .from(evalBatches)
    .where(eq(evalBatches.id, id));

  if (!batch) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(batch.agentId!, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const runs = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.batchId, id))
    .orderBy(asc(evalRuns.runIndex));

  return Response.json({ batch, runs } satisfies EvalBatchDetail);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [batch] = await db
    .select()
    .from(evalBatches)
    .where(eq(evalBatches.id, id));

  if (!batch) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(batch.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Cascade delete: batch → runs → results
  await db.delete(evalBatches).where(eq(evalBatches.id, id));

  return Response.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [batch] = await db
    .select()
    .from(evalBatches)
    .where(eq(evalBatches.id, id));

  if (!batch) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(batch.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (typeof body.isBaseline === "boolean") {
    if (body.isBaseline) {
      // Clear existing baselines for this agent
      await db
        .update(evalBatches)
        .set({ isBaseline: false })
        .where(
          and(
            eq(evalBatches.agentId, batch.agentId!),
            ne(evalBatches.id, id)
          )
        );
    }
    await db
      .update(evalBatches)
      .set({ isBaseline: body.isBaseline })
      .where(eq(evalBatches.id, id));
  }

  const [updated] = await db
    .select()
    .from(evalBatches)
    .where(eq(evalBatches.id, id));

  return Response.json(updated);
}
