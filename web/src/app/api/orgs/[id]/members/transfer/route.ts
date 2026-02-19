import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "owner");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { targetUserId } = body as { targetUserId: string };

  if (!targetUserId) {
    return NextResponse.json(
      { error: "targetUserId required" },
      { status: 400 }
    );
  }

  if (targetUserId === ctx.user.id) {
    return NextResponse.json(
      { error: "Cannot transfer to yourself" },
      { status: 400 }
    );
  }

  // Check target is a member
  const [targetMember] = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId))
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json(
      { error: "Target user is not a member" },
      { status: 404 }
    );
  }

  // Transaction: set target as owner, set current user as admin
  await db.transaction(async (tx) => {
    await tx
      .update(orgMembers)
      .set({ role: "owner", updatedAt: new Date() })
      .where(
        and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId))
      );

    await tx
      .update(orgMembers)
      .set({ role: "admin", updatedAt: new Date() })
      .where(
        and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, ctx.user.id))
      );
  });

  return NextResponse.json({ ok: true });
}
