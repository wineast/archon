import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole, requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { validateNoCycle } from "@/lib/datasets/queries";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, id), isNull(datasets.deletedAt)));

  if (!row) {
    return NextResponse.json(
      { error: "Dataset not found" },
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
    .from(datasets)
    .where(and(eq(datasets.id, id), isNull(datasets.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Dataset not found" },
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

  // Validate no circular dependency when data or key changes
  if (body.data !== undefined || body.key !== undefined) {
    const agentId = existing.agentId;
    if (agentId) {
      const allRows = await db
        .select({ id: datasets.id, key: datasets.key, data: datasets.data })
        .from(datasets)
        .where(and(eq(datasets.agentId, agentId), isNull(datasets.deletedAt)));

      const updatedRows = allRows.map((r) =>
        r.id === id
          ? {
              key: body.key ?? r.key,
              data: body.data ?? r.data,
            }
          : { key: r.key, data: r.data }
      );

      try {
        validateNoCycle(updatedRows);
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: 400 }
        );
      }
    }
  }

  const [updated] = await db
    .update(datasets)
    .set({
      ...(body.key !== undefined && { key: body.key }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.data !== undefined && { data: body.data }),
    })
    .where(eq(datasets.id, id))
    .returning();

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "updated",
        resourceType: "dataset",
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
    .from(datasets)
    .where(and(eq(datasets.id, id), isNull(datasets.deletedAt)));

  if (!existing) {
    return NextResponse.json(
      { error: "Dataset not found" },
      { status: 404 }
    );
  }

  const ctx = existing.agentId === null
    ? await requireSuperAdmin()
    : await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(datasets).set({ deletedAt: new Date() }).where(eq(datasets.id, id));

  if (existing.agentId) {
    const userId = "user" in ctx ? ctx.user.id : ctx.id;
    after(async () => {
      await logAudit({
        agentId: existing.agentId!,
        userId,
        action: "deleted",
        resourceType: "dataset",
        resourceId: id,
        resourceKey: existing.key,
        resourceName: existing.name,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
