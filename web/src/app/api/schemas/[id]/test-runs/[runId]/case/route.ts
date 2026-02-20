import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemaTestRuns, schemaTestRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";

interface RunCaseBody {
  caseId: string;
  caseName: string;
  input: Record<string, unknown>;
  shouldPass: boolean;
  expectedErrors?: Array<{ path: string; message: string }>;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;
  const body: RunCaseBody = await req.json();
  const { caseId, caseName, input, shouldPass, expectedErrors } = body;

  // Verify run exists
  const [run] = await db
    .select()
    .from(schemaTestRuns)
    .where(eq(schemaTestRuns.id, runId));

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const start = Date.now();

  // Call the validate endpoint
  let actualValid = false;
  let actualErrors: Array<{ path: string; message: string }> = [];

  try {
    const origin = new URL(req.url).origin;
    const validateRes = await fetch(`${origin}/api/schemas/${id}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });

    const validateData = await validateRes.json();
    actualValid = validateData.valid;
    actualErrors = validateData.errors ?? [];
  } catch (e) {
    actualValid = false;
    actualErrors = [{ path: "", message: e instanceof Error ? e.message : String(e) }];
  }

  const durationMs = Date.now() - start;

  // Determine pass/fail
  let passed: boolean;
  if (shouldPass) {
    passed = actualValid === true;
  } else {
    if (!expectedErrors || expectedErrors.length === 0) {
      passed = actualValid === false;
    } else {
      // Must be invalid AND every expectedError must match an actual error
      passed = actualValid === false && expectedErrors.every((expected) =>
        actualErrors.some(
          (actual) =>
            actual.path === expected.path &&
            actual.message.includes(expected.message)
        )
      );
    }
  }

  // Save result to DB
  const [result] = await db
    .insert(schemaTestRunResults)
    .values({
      runId,
      caseId,
      caseName,
      input,
      shouldPass,
      expectedErrors: expectedErrors ?? null,
      actualValid,
      actualErrors,
      passed,
      durationMs,
    })
    .returning();

  return NextResponse.json({ result });
}
