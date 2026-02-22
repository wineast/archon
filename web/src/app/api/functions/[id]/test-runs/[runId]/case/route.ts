import { NextResponse } from "next/server";
import { db } from "@/db";
import { functions, functionTestRuns, functionTestRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import deepEqual from "fast-deep-equal";
import { compileAndExecFn, SandboxCompilationError } from "@/lib/functions/sandbox";
import { ALL_BASE_DEPS } from "@/lib/functions/compile";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { EMPTY_OBJECT_SCHEMA } from "@/lib/schemas/types";

export const maxDuration = 120;

interface RunCaseBody {
  caseId: string;
  caseName: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;
  const body: RunCaseBody = await req.json();
  const { caseId, caseName, input, expectedOutput } = body;

  // Verify run exists
  const [run] = await db
    .select()
    .from(functionTestRuns)
    .where(eq(functionTestRuns.id, runId));

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Load function
  const [fn] = await db
    .select()
    .from(functions)
    .where(eq(functions.id, id));

  if (!fn) {
    return NextResponse.json({ error: "Function not found" }, { status: 404 });
  }

  const start = Date.now();
  let output: unknown = null;
  let error: string | null = null;
  let passed = false;

  try {
    // Read inline parameters schema
    const parametersSchema = fn.parametersSchema ?? EMPTY_OBJECT_SCHEMA;

    // Validate input
    let validatedInput = input ?? {};
    if (Object.keys(parametersSchema.properties ?? {}).length > 0) {
      const inputSchema = buildInputSchema(parametersSchema);
      validatedInput = inputSchema.parse(input ?? {});
    }

    // Compile + execute in sandbox
    output = await compileAndExecFn(fn.code, validatedInput, ALL_BASE_DEPS);

    // Exact match comparison
    passed =
      expectedOutput == null ||
      deepEqual(output, expectedOutput);
  } catch (e) {
    if (e instanceof SandboxCompilationError) {
      error = `Compilation error: ${e.message}`;
    } else {
      error = e instanceof Error ? e.message : String(e);
    }
    passed = false;
  }

  const durationMs = Date.now() - start;

  // Save result to DB
  const [result] = await db
    .insert(functionTestRunResults)
    .values({
      runId,
      caseId,
      caseName,
      input,
      expectedOutput: expectedOutput ?? null,
      output: output ?? null,
      passed,
      error,
      durationMs,
    })
    .returning();

  return NextResponse.json({ result });
}
