import { NextResponse } from "next/server";
import { db } from "@/db";
import { functions } from "@/db/schema";
import { eq } from "drizzle-orm";
import deepEqual from "fast-deep-equal";
import { compileAndExecFn, SandboxCompilationError } from "@/lib/functions/sandbox";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { EMPTY_OBJECT_SCHEMA } from "@/lib/schemas/types";
import { getDefsMap, resolveInlineSchema } from "@/lib/schemas/resolve-inline";

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

  // Resolve $ref in parameters schema
  const defsMap = fn.agentId ? await getDefsMap(fn.agentId) : {};
  const parametersSchema =
    resolveInlineSchema(fn.parametersSchema ?? null, defsMap) ?? EMPTY_OBJECT_SCHEMA;

  // Validate input
  let validatedInput = input ?? {};
  if (Object.keys(parametersSchema.properties ?? {}).length > 0) {
    try {
      const inputSchema = buildInputSchema(parametersSchema, undefined, { defsMap });
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
    deepEqual(result, expectedOutput);

  return NextResponse.json({
    success: true,
    result,
    durationMs,
    passed,
  });
}
