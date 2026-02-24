import { db } from "@/db";
import { evalRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  if (!run.agentId) {
    return Response.json({ error: "Invalid run" }, { status: 400 });
  }

  const ctx = await requireAgentRole(run.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (run.status !== "running") {
    return Response.json(
      { error: "Run is not in running state" },
      { status: 400 }
    );
  }

  await db
    .update(evalRuns)
    .set({ status: "cancelled" })
    .where(eq(evalRuns.id, runId));

  return Response.json({ ok: true });
}
