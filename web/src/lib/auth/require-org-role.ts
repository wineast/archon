import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orgMembers, ORG_ROLE_LEVELS } from "@/db/schema";
import type { OrgRole, User } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ensureUser } from "./ensure-user";

export interface OrgAuthContext {
  user: User;
  role: OrgRole;
  isSuperAdmin: boolean;
}

/**
 * Authenticate + check org-level role.
 * Returns OrgAuthContext on success, or a NextResponse (401/403) on failure.
 */
export async function requireOrgRole(
  orgId: string,
  minRole: OrgRole
): Promise<OrgAuthContext | NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await ensureUser(clerkId);
  const isSuperAdmin = user.platformRole === "super_admin";

  // Super admin bypasses all checks
  if (isSuperAdmin) {
    return { user, role: "owner", isSuperAdmin: true };
  }

  // Check org membership
  const [membership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id))
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (ORG_ROLE_LEVELS[membership.role] >= ORG_ROLE_LEVELS[minRole]) {
    return { user, role: membership.role, isSuperAdmin: false };
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
