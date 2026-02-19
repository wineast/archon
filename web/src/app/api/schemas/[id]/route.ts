import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemas, schemaIncludes, tools } from "@/db/schema";
import type { SchemaWithIncludes } from "@/db/schema";
import { eq, or, asc, inArray } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveParameters, detectCycle } from "@/lib/schemas/resolve";

/** Get ordered include IDs for a single schema. */
async function getIncludeIds(schemaId: string): Promise<string[]> {
  const rows = await db
    .select({ includeSchemaId: schemaIncludes.includeSchemaId })
    .from(schemaIncludes)
    .where(eq(schemaIncludes.schemaId, schemaId))
    .orderBy(asc(schemaIncludes.position));
  return rows.map((r) => r.includeSchemaId);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(schemas)
    .where(eq(schemas.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  // Load all schemas + includes for resolving
  const allRows = await db
    .select()
    .from(schemas)
    .where(eq(schemas.agentId, existing.agentId));

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

  const schemaWithIncludes = allSchemasMap.get(id)!;

  return NextResponse.json({
    ...schemaWithIncludes,
    resolvedParameters: resolveParameters(schemaWithIncludes, allSchemasMap),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(schemas)
    .where(eq(schemas.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Validate cycle if includeSchemaIds is being updated
  if (body.includeSchemaIds !== undefined) {
    const allRows = await db
      .select()
      .from(schemas)
      .where(eq(schemas.agentId, existing.agentId));

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

    if (detectCycle(id, body.includeSchemaIds, allSchemasMap)) {
      return NextResponse.json(
        { error: "Circular include detected" },
        { status: 400 }
      );
    }
  }

  const [updated] = await db
    .update(schemas)
    .set({
      // key is NOT updatable
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.parameters !== undefined && { parameters: body.parameters }),
    })
    .where(eq(schemas.id, id))
    .returning();

  // Update includes if provided
  if (body.includeSchemaIds !== undefined) {
    // Delete old includes
    await db.delete(schemaIncludes).where(eq(schemaIncludes.schemaId, id));
    // Insert new includes with position
    const newIncludes: string[] = body.includeSchemaIds;
    if (newIncludes.length > 0) {
      await db.insert(schemaIncludes).values(
        newIncludes.map((includeId, i) => ({
          schemaId: id,
          includeSchemaId: includeId,
          position: i,
        }))
      );
    }
  }

  // Return with includeSchemaIds
  const includeIds = body.includeSchemaIds !== undefined
    ? body.includeSchemaIds
    : await getIncludeIds(id);

  return NextResponse.json({ ...updated, includeSchemaIds: includeIds });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(schemas)
    .where(eq(schemas.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Check if any tools reference this schema
  const referencingTools = await db
    .select({ id: tools.id, name: tools.name })
    .from(tools)
    .where(
      or(
        eq(tools.parametersSchemaId, id),
        eq(tools.returnParametersSchemaId, id)
      )
    );

  if (referencingTools.length > 0) {
    const names = referencingTools.map((t) => t.name).join(", ");
    return NextResponse.json(
      {
        error: `Schema is referenced by: ${names}. Remove references before deleting.`,
      },
      { status: 400 }
    );
  }

  // CASCADE on schemaIncludes handles cleanup automatically
  await db.delete(schemas).where(eq(schemas.id, id));
  return NextResponse.json({ ok: true });
}
