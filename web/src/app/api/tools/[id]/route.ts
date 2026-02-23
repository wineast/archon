import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole, requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { validateObjectSchema } from "@/lib/schemas/json-schema-utils";
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

  // Pool resource (agentId IS NULL) → require super admin
  // Private resource → require agent editor role
  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Builtin tools: only allow toggling enabled
  if (existing.origin === "builtin") {
    if (typeof body.enabled !== "boolean" || Object.keys(body).length !== 1) {
      return NextResponse.json(
        { error: "System tools can only be enabled/disabled" },
        { status: 403 }
      );
    }
    const [updated] = await db
      .update(tools)
      .set({ enabled: body.enabled })
      .where(eq(tools.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  for (const [field, label] of [
    ["parametersSchema", "parametersSchema"],
    ["returnParametersSchema", "returnParametersSchema"],
  ] as const) {
    const err = validateObjectSchema(body[field], label);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const [updated] = await db
    .update(tools)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.handler !== undefined && { handler: body.handler }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.componentId !== undefined && { componentId: body.componentId }),
      ...(body.parametersSchema !== undefined && { parametersSchema: body.parametersSchema }),
      ...(body.returnParametersSchema !== undefined && { returnParametersSchema: body.returnParametersSchema }),
      ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
      ...(typeof body.uiHidden === "boolean" && { uiHidden: body.uiHidden }),
      ...(body.executionTarget !== undefined && { executionTarget: body.executionTarget }),
    })
    .where(eq(tools.id, id))
    .returning();

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "updated",
        resourceType: "tool",
        resourceId: id,
        resourceKey: updated.key,
        resourceName: updated.name,
      });
    });
  }

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

  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  if (existing.origin === "builtin") {
    return NextResponse.json(
      { error: "Builtin tools cannot be deleted" },
      { status: 403 }
    );
  }

  await db.update(tools).set({ deletedAt: new Date() }).where(eq(tools.id, id));

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "deleted",
        resourceType: "tool",
        resourceId: id,
        resourceKey: existing.key,
        resourceName: existing.name,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
