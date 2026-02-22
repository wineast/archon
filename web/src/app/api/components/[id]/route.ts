import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { components } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole, requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { validateObjectSchema } from "@/lib/schemas/json-schema-utils";
import { compileCssForComponent } from "@/lib/components/compile-css";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(components)
    .where(and(eq(components.id, id), isNull(components.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  // Pool resource (agentId IS NULL) → require super admin
  // Private resource → require agent editor role
  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  for (const [field, label] of [
    ["toolInputSchema", "toolInputSchema"],
    ["componentInputSchema", "componentInputSchema"],
  ] as const) {
    const err = validateObjectSchema(body[field], label);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  // Recompile CSS when componentSource changes
  let generatedCss: string | undefined;
  if (body.componentSource !== undefined) {
    generatedCss = await compileCssForComponent(body.componentSource);
  }

  const [updated] = await db
    .update(components)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.componentSource !== undefined && { componentSource: body.componentSource }),
      ...(generatedCss !== undefined && { generatedCss }),
      ...(body.toolInputSchema !== undefined && { toolInputSchema: body.toolInputSchema }),
      ...(body.componentInputSchema !== undefined && { componentInputSchema: body.componentInputSchema }),
    })
    .where(eq(components.id, id))
    .returning();

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "updated",
        resourceType: "component",
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
    .from(components)
    .where(and(eq(components.id, id), isNull(components.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(components).set({ deletedAt: new Date() }).where(eq(components.id, id));

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "deleted",
        resourceType: "component",
        resourceId: id,
        resourceKey: existing.key,
        resourceName: existing.name,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
