import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools, toolTestRuns, toolTestRunResults, schemas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { createToolContext } from "@/lib/tools/tool-context";
import { executeToolHandler } from "@/lib/tools/execute-handler";

/** Stable JSON stringify with sorted keys for deep equality comparison. */
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
    .from(toolTestRuns)
    .where(eq(toolTestRuns.id, runId));

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Load tool
  const [tool] = await db
    .select()
    .from(tools)
    .where(eq(tools.id, id));

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const start = Date.now();
  let output: unknown = null;
  let error: string | null = null;
  let passed = false;

  try {
    if (!tool.handler?.trim()) {
      throw new Error("Tool has no handler defined");
    }

    // Validate input against schema parameters
    let validatedInput = input ?? {};
    if (tool.parametersSchemaId) {
      const [schemaRow] = await db
        .select()
        .from(schemas)
        .where(eq(schemas.id, tool.parametersSchemaId));
      if (schemaRow && schemaRow.parameters.length > 0) {
        const inputSchema = buildInputSchema(schemaRow.parameters);
        validatedInput = inputSchema.parse(input ?? {});
      }
    }

    // Execute in sandbox
    const context = createToolContext(tool.agentId ?? undefined);
    output = await executeToolHandler(tool.handler, validatedInput, context, tool.sandboxMode);

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
    .insert(toolTestRunResults)
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
