import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitationCodes } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth/require-agent-role";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { label, maxUses, isActive, expiresAt } = body as {
    label?: string;
    maxUses?: number | null;
    isActive?: boolean;
    expiresAt?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label;
  if (maxUses !== undefined) updates.maxUses = maxUses;
  if (isActive !== undefined) updates.isActive = isActive;
  if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(invitationCodes)
    .set(updates)
    .where(eq(invitationCodes.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;

  const { id } = await params;

  const [deleted] = await db
    .delete(invitationCodes)
    .where(eq(invitationCodes.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
