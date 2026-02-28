import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemas } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { ZodError } from "zod";
import { getResolvedDatasets } from "@/lib/datasets/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { input } = (await req.json()) as { input: Record<string, unknown> };

  const start = Date.now();

  // Load schema
  const [schema] = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

  if (!schema) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  // Load all schemas for the same agent (for $ref resolution)
  const allRows = schema.agentId
    ? await db
        .select()
        .from(schemas)
        .where(and(eq(schemas.agentId, schema.agentId), isNull(schemas.deletedAt)))
    : [];

  // Build defsMap: schema key → parameters
  const defsMap: Record<string, JsonSchema7> = {};
  for (const row of allRows) {
    defsMap[row.key] = row.parameters as JsonSchema7;
  }

  // Load resolved dataset variables for template enum expansion
  const { resolvedVars } = schema.agentId && schema.versionId
    ? await getResolvedDatasets(schema.agentId, schema.versionId)
    : { resolvedVars: {} };

  // Build Zod schema and validate
  try {
    const zodSchema = buildInputSchema(
      schema.parameters as JsonSchema7,
      resolvedVars,
      { defsMap }
    );
    zodSchema.parse(input ?? {});

    return NextResponse.json({
      valid: true,
      errors: [],
      durationMs: Date.now() - start,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      const errors = e.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return NextResponse.json({
        valid: false,
        errors,
        durationMs: Date.now() - start,
      });
    }

    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      valid: false,
      errors: [{ path: "", message: msg }],
      durationMs: Date.now() - start,
    });
  }
}
