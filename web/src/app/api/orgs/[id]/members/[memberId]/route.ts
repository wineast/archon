import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgMembers, ORG_ROLE_LEVELS } from "@/db/schema";
import type { OrgRole } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: orgId, memberId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { role } = body as { role: string };

  if (!role || !["member", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Look up target member
  const [target] = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId))
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot change owner's role
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Cannot change owner role" },
      { status: 403 }
    );
  }

  // Cannot change own role
  if (target.userId === ctx.user.id) {
    return NextResponse.json(
      { error: "Cannot change own role" },
      { status: 403 }
    );
  }

  // Cannot set role higher than own role
  if (ORG_ROLE_LEVELS[role as OrgRole] > ORG_ROLE_LEVELS[ctx.role]) {
    return NextResponse.json(
      { error: "Cannot set role higher than own" },
      { status: 403 }
    );
  }

  // Admin cannot change other admins (only owner can)
  if (
    ctx.role !== "owner" &&
    !ctx.isSuperAdmin &&
    ORG_ROLE_LEVELS[target.role] >= ORG_ROLE_LEVELS[ctx.role]
  ) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  const [updated] = await db
    .update(orgMembers)
    .set({ role: role as OrgRole, updatedAt: new Date() })
    .where(eq(orgMembers.id, memberId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: orgId, memberId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  // Look up target member
  const [target] = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId))
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot remove owner
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove owner" },
      { status: 403 }
    );
  }

  // Cannot remove self
  if (target.userId === ctx.user.id) {
    return NextResponse.json(
      { error: "Cannot remove self" },
      { status: 403 }
    );
  }

  // Admin cannot remove other admins (only owner can)
  if (
    ctx.role !== "owner" &&
    !ctx.isSuperAdmin &&
    ORG_ROLE_LEVELS[target.role] >= ORG_ROLE_LEVELS[ctx.role]
  ) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  await db.delete(orgMembers).where(eq(orgMembers.id, memberId));

  return NextResponse.json({ ok: true });
}
