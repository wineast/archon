import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { functions } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { clearFunctionCache } from "@/lib/functions/compile";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(functions)
    .where(and(eq(functions.id, id), isNull(functions.deletedAt)));

  if (!row) {
    return NextResponse.json(
      { error: "Function not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(row.agentId!, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(functions)
    .where(and(eq(functions.id, id), isNull(functions.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Function not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(functions)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.parametersSchemaId !== undefined && { parametersSchemaId: body.parametersSchemaId }),
      ...(body.returnParametersSchemaId !== undefined && { returnParametersSchemaId: body.returnParametersSchemaId }),
    })
    .where(eq(functions.id, id))
    .returning();

  if (existing.agentId) {
    clearFunctionCache(existing.agentId);
  }

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "function",
      resourceId: id,
      resourceKey: updated.key,
      resourceName: updated.name,
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(functions)
    .where(and(eq(functions.id, id), isNull(functions.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Function not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(functions).set({ deletedAt: new Date() }).where(eq(functions.id, id));

  if (existing.agentId) {
    clearFunctionCache(existing.agentId);
  }

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "deleted",
      resourceType: "function",
      resourceId: id,
      resourceKey: existing.key,
      resourceName: existing.name,
    });
  });

  return NextResponse.json({ ok: true });
}
