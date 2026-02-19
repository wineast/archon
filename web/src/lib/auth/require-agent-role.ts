import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, agentMembers, orgMembers, users, AGENT_ROLE_LEVELS, ORG_ROLE_LEVELS } from "@/db/schema";
import type { AgentRole, OrgRole, User } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ensureUser } from "./ensure-user";

export interface AuthContext {
  user: User;
  role: AgentRole;
  isSuperAdmin: boolean;
}

/**
 * Compute the effective agent role from direct membership and org membership.
 * Exported as a pure function for testing.
 */
export function computeEffectiveRole(
  directRole: AgentRole | null,
  orgRole: OrgRole | null,
  isPublic: boolean
): AgentRole | null {
  // Map org role → agent role
  const orgToAgent: Record<OrgRole, AgentRole> = {
    owner: "owner",
    admin: "admin",
    member: "viewer",
  };

  const inheritedRole = orgRole ? orgToAgent[orgRole] : null;

  const directLevel = directRole ? AGENT_ROLE_LEVELS[directRole] : -1;
  const inheritedLevel = inheritedRole ? AGENT_ROLE_LEVELS[inheritedRole] : -1;

  if (directLevel >= 0 || inheritedLevel >= 0) {
    if (directLevel >= inheritedLevel) return directRole!;
    return inheritedRole!;
  }

  // No membership — check public access
  if (isPublic) return "viewer";

  return null;
}

/**
 * Authenticate + check agent-level role.
 * Returns AuthContext on success, or a NextResponse (401/403) on failure.
 */
export async function requireAgentRole(
  agentId: string,
  minRole: AgentRole
): Promise<AuthContext | NextResponse> {
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

  // Get agent info (orgId + isPublic)
  const [agent] = await db
    .select({ orgId: agents.orgId, isPublic: agents.isPublic })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Check direct agent membership
  const [directMembership] = await db
    .select({ role: agentMembers.role })
    .from(agentMembers)
    .where(
      and(eq(agentMembers.agentId, agentId), eq(agentMembers.userId, user.id))
    )
    .limit(1);

  // Check org membership
  const [orgMembership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, agent.orgId), eq(orgMembers.userId, user.id))
    )
    .limit(1);

  const effectiveRole = computeEffectiveRole(
    directMembership?.role ?? null,
    orgMembership?.role ?? null,
    agent.isPublic
  );

  if (effectiveRole && AGENT_ROLE_LEVELS[effectiveRole] >= AGENT_ROLE_LEVELS[minRole]) {
    return { user, role: effectiveRole, isSuperAdmin: false };
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Authentication only — no agent role check.
 * Returns User on success, or a NextResponse (401) on failure.
 */
export async function requireAuth(): Promise<User | NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return ensureUser(clerkId);
}

/**
 * Require super_admin platform role.
 */
export async function requireSuperAdmin(): Promise<User | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (result.platformRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}
