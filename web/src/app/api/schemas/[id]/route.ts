import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemas, tools } from "@/db/schema";
import { eq, or, and, not, isNull } from "drizzle-orm";
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
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  // Load all schemas for resolving
  const allRows = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.agentId, existing.agentId), isNull(schemas.deletedAt)));
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
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

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
      .where(and(eq(schemas.agentId, existing.agentId), isNull(schemas.deletedAt)));
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
    .where(and(eq(schemas.id, id), isNull(schemas.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Schema not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Check if any non-deleted tools reference this schema
  const referencingTools = await db
    .select({ id: tools.id, name: tools.name })
    .from(tools)
    .where(
      and(
        or(
          eq(tools.parametersSchemaId, id),
          eq(tools.returnParametersSchemaId, id)
        ),
        isNull(tools.deletedAt)
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

  // Remove this schema ID from other non-deleted schemas' includeSchemaIds
  const includingSchemas = await db
    .select({ id: schemas.id, includeSchemaIds: schemas.includeSchemaIds })
    .from(schemas)
    .where(
      and(
        eq(schemas.agentId, existing.agentId),
        not(eq(schemas.id, id)),
        isNull(schemas.deletedAt)
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

  await db.update(schemas).set({ deletedAt: new Date() }).where(eq(schemas.id, id));
  return NextResponse.json({ ok: true });
}
