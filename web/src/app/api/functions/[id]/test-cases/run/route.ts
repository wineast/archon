import { NextResponse } from "next/server";
import { db } from "@/db";
import { functions, schemas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compileAndExecFn, SandboxCompilationError } from "@/lib/functions/sandbox";
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Load saved function from DB
  const [fn] = await db
    .select()
    .from(functions)
    .where(eq(functions.id, id));

  if (!fn) {
    return NextResponse.json(
      { error: "Function not found" },
      { status: 404 }
    );
  }

  const { input, expectedOutput } = (await req.json()) as {
    input: Record<string, unknown>;
    expectedOutput?: unknown;
  };

  const start = Date.now();

  // Resolve parameters from schema FK
  let parameters: ToolParameter[] = [];
  if (fn.parametersSchemaId) {
    const [schemaRow] = await db.select().from(schemas).where(eq(schemas.id, fn.parametersSchemaId));
    if (schemaRow) parameters = schemaRow.parameters;
  }

  // Validate input
  let validatedInput = input ?? {};
  if (parameters.length > 0) {
    try {
      const inputSchema = buildInputSchema(parameters);
      validatedInput = inputSchema.parse(input ?? {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({
        success: false,
        error: `Validation error: ${msg}`,
        durationMs: Date.now() - start,
        passed: false,
      });
    }
  }

  // Compile + execute in sandbox
  let result: unknown;
  try {
    result = await compileAndExecFn(fn.code, validatedInput);
  } catch (e) {
    if (e instanceof SandboxCompilationError) {
      return NextResponse.json({
        success: false,
        error: `Compilation error: ${e.message}`,
        durationMs: Date.now() - start,
        passed: false,
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Execution error: ${msg}`,
      durationMs: Date.now() - start,
      passed: false,
    });
  }

  const durationMs = Date.now() - start;

  // Exact match comparison
  const passed =
    expectedOutput == null ||
    stableStringify(result) === stableStringify(expectedOutput);

  return NextResponse.json({
    success: true,
    result,
    durationMs,
    passed,
  });
}
