import { NextResponse } from "next/server";
import { db } from "@/db";
import { components } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { compileCssForComponent } from "@/lib/components/compile-css";

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

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

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
    })
    .where(eq(components.id, id))
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
    .from(components)
    .where(and(eq(components.id, id), isNull(components.deletedAt)));

  if (!existing) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(components).set({ deletedAt: new Date() }).where(eq(components.id, id));
  return NextResponse.json({ ok: true });
}
