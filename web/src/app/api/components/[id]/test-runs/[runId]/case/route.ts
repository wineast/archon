import { NextResponse } from "next/server";
import { db } from "@/db";
import { componentTestRuns, componentTestRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";

interface RunCaseBody {
  caseId: string;
  caseName: string;
  tool: { name: string; input: unknown; output: unknown };
  passed: boolean;
  error?: string;
  durationMs: number;
}

/** POST: save client-computed test result (no server-side execution) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;
  const body: RunCaseBody = await req.json();
  const { caseId, caseName, tool, passed, error, durationMs } = body;

  // Verify run exists
  const [run] = await db
    .select()
    .from(componentTestRuns)
    .where(eq(componentTestRuns.id, runId));

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const [result] = await db
    .insert(componentTestRunResults)
    .values({
      runId,
      caseId,
      caseName,
      tool,
      passed,
      error: error ?? null,
      durationMs,
    })
    .returning();

  return NextResponse.json({ result });
}
