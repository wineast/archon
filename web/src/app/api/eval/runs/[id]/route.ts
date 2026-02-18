import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, id));

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(run.agentId!, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const results = await db
    .select()
    .from(evalRunResults)
    .where(eq(evalRunResults.runId, id));

  return Response.json({ run, results });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, id));

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(run.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(evalRuns).where(eq(evalRuns.id, id));

  return Response.json({ ok: true });
}
