import { db } from "@/db";
import { schemaTestRuns, schemaTestRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";

/** GET: run detail + all results */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;

  const [run] = await db
    .select()
    .from(schemaTestRuns)
    .where(eq(schemaTestRuns.id, runId));

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const results = await db
    .select()
    .from(schemaTestRunResults)
    .where(eq(schemaTestRunResults.runId, runId));

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
    .from(schemaTestRunResults)
    .where(eq(schemaTestRunResults.runId, runId));

  const totalCases = results.length;
  const passedCases = results.filter((r) => r.passed).length;

  await db
    .update(schemaTestRuns)
    .set({ totalCases, passedCases })
    .where(eq(schemaTestRuns.id, runId));

  return Response.json({ passedCases, totalCases });
}

/** DELETE: remove run (cascade deletes results) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;

  await db.delete(schemaTestRuns).where(eq(schemaTestRuns.id, runId));

  return Response.json({ ok: true });
}
