import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemas, schemaIncludes, datasets } from "@/db/schema";
import type { SchemaWithIncludes } from "@/db/schema";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { resolveParameters } from "@/lib/schemas/resolve";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import type { SchemaProperty } from "@/lib/schemas/types";
import { ZodError } from "zod";

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

  // Load all schemas for the same agent (for resolving includes and schemaId references)
  const allRows = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.agentId, schema.agentId), isNull(schemas.deletedAt)));

  const allIncludeRows = allRows.length > 0
    ? await db
        .select()
        .from(schemaIncludes)
        .where(inArray(schemaIncludes.schemaId, allRows.map((r) => r.id)))
        .orderBy(asc(schemaIncludes.position))
    : [];

  const includesBySchemaId = new Map<string, string[]>();
  for (const row of allIncludeRows) {
    const arr = includesBySchemaId.get(row.schemaId) ?? [];
    arr.push(row.includeSchemaId);
    includesBySchemaId.set(row.schemaId, arr);
  }

  const allSchemasMap = new Map<string, SchemaWithIncludes>(
    allRows.map((r) => [r.id, { ...r, includeSchemaIds: includesBySchemaId.get(r.id) ?? [] }])
  );

  // Resolve parameters (merge includes)
  const schemaWithIncludes = allSchemasMap.get(id)!;
  const resolvedParams = resolveParameters(schemaWithIncludes, allSchemasMap);

  // Build schemaMap for object type params that reference other schemas via schemaId
  const schemaMap: Record<string, SchemaProperty[]> = {};
  for (const [sid, s] of allSchemasMap) {
    const resolved = resolveParameters(s, allSchemasMap);
    schemaMap[sid] = resolved;
  }

  // Load datasets for enum params that reference datasets via enumDatasetId
  const datasetRows = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.agentId, schema.agentId), isNull(datasets.deletedAt)));

  const datasetsById: Record<string, unknown> = {};
  for (const d of datasetRows) {
    datasetsById[d.id] = d.data;
  }

  // Build Zod schema and validate
  try {
    const zodSchema = buildInputSchema(resolvedParams, {}, { schemaMap, datasetsById });
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
