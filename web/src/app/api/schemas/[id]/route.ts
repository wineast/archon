import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemas, tools, components } from "@/db/schema";
import { eq, or, and, not } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveParameters, detectCycle } from "@/lib/schemas/resolve";

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

  // Load all schemas for resolving
  const allRows = await db
    .select()
    .from(schemas)
    .where(eq(schemas.agentId, existing.agentId));
  const allSchemasMap = new Map(allRows.map((r) => [r.id, r]));

  return NextResponse.json({
    ...existing,
    resolvedParameters: resolveParameters(existing, allSchemasMap),
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
    const allSchemasMap = new Map(allRows.map((r) => [r.id, r]));

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
      ...(body.includeSchemaIds !== undefined && { includeSchemaIds: body.includeSchemaIds }),
    })
    .where(eq(schemas.id, id))
    .returning();

  return NextResponse.json(updated);
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

  // Check if any tools or components reference this schema
  const referencingTools = await db
    .select({ id: tools.id, name: tools.name })
    .from(tools)
    .where(
      or(
        eq(tools.parametersSchemaId, id),
        eq(tools.returnParametersSchemaId, id)
      )
    );

  const referencingComponents = await db
    .select({ id: components.id, name: components.name })
    .from(components)
    .where(eq(components.schemaId, id));

  if (referencingTools.length > 0 || referencingComponents.length > 0) {
    const names = [
      ...referencingTools.map((t) => t.name),
      ...referencingComponents.map((c) => c.name),
    ].join(", ");
    return NextResponse.json(
      {
        error: `Schema is referenced by: ${names}. Remove references before deleting.`,
      },
      { status: 400 }
    );
  }

  // Remove this schema ID from other schemas' includeSchemaIds
  const includingSchemas = await db
    .select({ id: schemas.id, includeSchemaIds: schemas.includeSchemaIds })
    .from(schemas)
    .where(
      and(
        eq(schemas.agentId, existing.agentId),
        not(eq(schemas.id, id))
      )
    );

  for (const s of includingSchemas) {
    if (s.includeSchemaIds.includes(id)) {
      await db
        .update(schemas)
        .set({
          includeSchemaIds: s.includeSchemaIds.filter((sid) => sid !== id),
        })
        .where(eq(schemas.id, s.id));
    }
  }

  await db.delete(schemas).where(eq(schemas.id, id));
  return NextResponse.json({ ok: true });
}
