import { db } from "@/db";
import { toolTestRuns, toolTestRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";

/** GET: run detail + all results */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;

  const [run] = await db
    .select()
    .from(toolTestRuns)
    .where(eq(toolTestRuns.id, runId));

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const results = await db
    .select()
    .from(toolTestRunResults)
    .where(eq(toolTestRunResults.runId, runId));

  return Response.json({ run, results });
}

/** PATCH: finalize run — aggregate passedCases */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;

  const results = await db
    .select()
    .from(toolTestRunResults)
    .where(eq(toolTestRunResults.runId, runId));

  const totalCases = results.length;
  const passedCases = results.filter((r) => r.passed).length;

  await db
    .update(toolTestRuns)
    .set({ totalCases, passedCases })
    .where(eq(toolTestRuns.id, runId));

  return Response.json({ passedCases, totalCases });
}

/** DELETE: remove run (cascade deletes results) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;

  await db.delete(toolTestRuns).where(eq(toolTestRuns.id, runId));

  return Response.json({ ok: true });
}
