import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  await db.delete(evalRuns).where(eq(evalRuns.id, id));

  return Response.json({ ok: true });
}
