import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(tools)
    .where(eq(tools.id, id));

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
      ...(body.component !== undefined && { component: body.component }),
      ...(body.parametersSchemaId !== undefined && { parametersSchemaId: body.parametersSchemaId }),
      ...(body.returnParametersSchemaId !== undefined && { returnParametersSchemaId: body.returnParametersSchemaId }),
      ...(body.componentSource !== undefined && { componentSource: body.componentSource }),
      ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
      ...(body.executionTarget !== undefined && { executionTarget: body.executionTarget }),
    })
    .where(eq(tools.id, id))
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
    .from(tools)
    .where(eq(tools.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(tools).where(eq(tools.id, id));
  return NextResponse.json({ ok: true });
}
