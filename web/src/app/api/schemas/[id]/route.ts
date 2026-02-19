import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemas, tools } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

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
    .where(eq(schemas.id, id));

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

  // Check if any tools reference this schema
  const referencingTools = await db
    .select({ id: tools.id, name: tools.name })
    .from(tools)
    .where(
      or(
        eq(tools.parametersSchemaRef, existing.key),
        eq(tools.returnParametersSchemaRef, existing.key)
      )
    );

  if (referencingTools.length > 0) {
    const names = referencingTools.map((t) => t.name).join(", ");
    return NextResponse.json(
      {
        error: `Schema is referenced by tools: ${names}. Remove references before deleting.`,
      },
      { status: 400 }
    );
  }

  await db.delete(schemas).where(eq(schemas.id, id));
  return NextResponse.json({ ok: true });
}
