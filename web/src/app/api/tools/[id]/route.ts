import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(tools)
    .where(and(eq(tools.id, id), isNull(tools.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [updated] = await db
    .update(tools)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.handler !== undefined && { handler: body.handler }),
      ...(body.componentId !== undefined && { componentId: body.componentId }),
      ...(body.parametersSchemaId !== undefined && { parametersSchemaId: body.parametersSchemaId }),
      ...(body.returnParametersSchemaId !== undefined && { returnParametersSchemaId: body.returnParametersSchemaId }),
      ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
      ...(body.executionTarget !== undefined && { executionTarget: body.executionTarget }),
    })
    .where(eq(tools.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "tool",
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
    .from(tools)
    .where(and(eq(tools.id, id), isNull(tools.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(tools).set({ deletedAt: new Date() }).where(eq(tools.id, id));

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "tool",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
