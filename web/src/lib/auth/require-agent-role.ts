import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, agentMembers, users, AGENT_ROLE_LEVELS } from "@/db/schema";
import type { AgentRole, User } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { ensureUser } from "./ensure-user";

export interface AuthContext {
  user: User;
  role: AgentRole;
  isSuperAdmin: boolean;
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

  // Check agent membership
  const [membership] = await db
    .select()
    .from(agentMembers)
    .where(
      and(eq(agentMembers.agentId, agentId), eq(agentMembers.userId, user.id))
    )
    .limit(1);

  if (membership) {
    if (AGENT_ROLE_LEVELS[membership.role] >= AGENT_ROLE_LEVELS[minRole]) {
      return { user, role: membership.role, isSuperAdmin: false };
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if agent is public (grants viewer access)
  if (AGENT_ROLE_LEVELS["viewer"] >= AGENT_ROLE_LEVELS[minRole]) {
    const [agent] = await db
      .select({ isPublic: agents.isPublic })
      .from(agents)
      .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
      .limit(1);

    if (agent?.isPublic) {
      return { user, role: "viewer", isSuperAdmin: false };
    }
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
