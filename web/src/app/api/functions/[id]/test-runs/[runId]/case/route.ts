import { NextResponse } from "next/server";
import { db } from "@/db";
import { functions, schemas, functionTestRuns, functionTestRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compileFn } from "@/lib/functions/compile";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import type { ToolParameter } from "@/lib/tools/types";

/** Stable JSON stringify with sorted keys for deep equality comparison.
 *  Skips keys whose value is `undefined` (matching JSON.stringify behaviour). */
function stableStringify(val: unknown): string {
  if (val === undefined) return "null";
  if (val === null) return "null";
  if (typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val))
    return "[" + val.map(stableStringify).join(",") + "]";
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

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
    // Compile
    const compiled = compileFn(fn.code);
    if (typeof compiled !== "function") {
      throw new Error("Function code must return a callable");
    }

    // Resolve parameters from schema FK
    let parameters: ToolParameter[] = [];
    if (fn.parametersSchemaId) {
      const [schemaRow] = await db.select().from(schemas).where(eq(schemas.id, fn.parametersSchemaId));
      if (schemaRow) parameters = schemaRow.parameters;
    }

    // Validate input
    let validatedInput = input ?? {};
    if (parameters.length > 0) {
      const inputSchema = buildInputSchema(parameters);
      validatedInput = inputSchema.parse(input ?? {});
    }

    // Execute
    output = await (compiled as (input: unknown) => unknown)(validatedInput);

    // Exact match comparison
    passed =
      expectedOutput == null ||
      stableStringify(output) === stableStringify(expectedOutput);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
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
