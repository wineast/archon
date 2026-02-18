import { NextResponse } from "next/server";
import { db } from "@/db";
import { functions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compileFn } from "@/lib/functions/compile";
import { buildInputSchema } from "@/lib/tools/schema-builder";

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

  // Compile
  let compiled: unknown;
  try {
    compiled = compileFn(fn.code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Compilation error: ${msg}`,
      durationMs: Date.now() - start,
      passed: false,
    });
  }

  if (typeof compiled !== "function") {
    return NextResponse.json({
      success: false,
      error: "Function code must return a callable",
      durationMs: Date.now() - start,
      passed: false,
    });
  }

  // Validate input
  let validatedInput = input ?? {};
  if (fn.parameters && fn.parameters.length > 0) {
    try {
      const schema = buildInputSchema(fn.parameters);
      validatedInput = schema.parse(input ?? {});
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

  // Execute
  let result: unknown;
  try {
    result = await (compiled as (input: unknown) => unknown)(validatedInput);
  } catch (e) {
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
