import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { functions } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole, requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { validateObjectSchema } from "@/lib/schemas/json-schema-utils";
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

  const ctx = row.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(row.agentId, "viewer");
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

  // Pool resource (agentId IS NULL) → require super admin
  // Private resource → require agent editor role
  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  for (const [field, label] of [
    ["parametersSchema", "parametersSchema"],
    ["returnParametersSchema", "returnParametersSchema"],
  ] as const) {
    const err = validateObjectSchema(body[field], label);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const [updated] = await db
    .update(functions)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.parametersSchema !== undefined && { parametersSchema: body.parametersSchema }),
      ...(body.returnParametersSchema !== undefined && { returnParametersSchema: body.returnParametersSchema }),
    })
    .where(eq(functions.id, id))
    .returning();

  if (existing.agentId && existing.versionId) {
    clearFunctionCache(existing.agentId, existing.versionId);
  }

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "updated",
        resourceType: "function",
        resourceId: id,
        resourceKey: updated.key,
        resourceName: updated.name,
      });
    });
  }

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

  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(functions).set({ deletedAt: new Date() }).where(eq(functions.id, id));

  if (existing.agentId && existing.versionId) {
    clearFunctionCache(existing.agentId, existing.versionId);
  }

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "deleted",
        resourceType: "function",
        resourceId: id,
        resourceKey: existing.key,
        resourceName: existing.name,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
