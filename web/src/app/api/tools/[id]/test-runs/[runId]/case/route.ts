import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools, toolTestRuns, toolTestRunResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import deepEqual from "fast-deep-equal";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { createToolContext } from "@/lib/tools/tool-context";
import { executeToolHandler } from "@/lib/tools/execute-handler";
import { runAllAssertions } from "@/lib/eval/assertions";
import type { Assertion, AssertionResult } from "@/lib/eval/types";

export const maxDuration = 120;

interface RunCaseBody {
  caseId: string;
  caseName: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
  assertions?: Assertion[];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;
  const body: RunCaseBody = await req.json();
  const { caseId, caseName, input, expectedOutput, assertions } = body;

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
  let assertionResults: AssertionResult[] = [];

  try {
    if (!tool.handler?.trim() && !tool.url?.trim()) {
      throw new Error("Tool has no handler defined");
    }

    // Validate input against schema parameters
    let validatedInput = input ?? {};
    if (tool.parametersSchema) {
      const schema = tool.parametersSchema;
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const parsedSchema = buildInputSchema(schema);
        validatedInput = parsedSchema.parse(input ?? {});
      }
    }

    // Execute handler
    const url = tool.url?.trim();
    if (url) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedInput),
      });
      if (!res.ok) {
        throw new Error(`Handler returned ${res.status}: ${await res.text()}`);
      }
      output = await res.json();
    } else {
      const context = createToolContext(tool.agentId ?? undefined, tool.versionId ?? undefined);
      output = await executeToolHandler(tool.handler!, validatedInput, context);
    }

    // Judgment: expectedOutput exact match + assertions
    passed = true;
    if (expectedOutput != null) {
      passed = passed && deepEqual(output, expectedOutput);
    }
    if (assertions && assertions.length > 0) {
      assertionResults = runAllAssertions(assertions, JSON.stringify(output));
      passed = passed && assertionResults.every((r) => r.passed);
    }
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
      assertionResults: assertionResults.length > 0 ? assertionResults : null,
      durationMs,
    })
    .returning();

  return NextResponse.json({ result });
}
