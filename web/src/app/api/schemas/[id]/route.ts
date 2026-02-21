import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { schemas, tools } from "@/db/schema";
import { eq, or, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

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

  return NextResponse.json(existing);
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

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "schema",
      resourceId: id,
      resourceKey: updated.key,
      resourceName: updated.name,
    });
  });

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

  await db.update(schemas).set({ deletedAt: new Date() }).where(eq(schemas.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "schema",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
