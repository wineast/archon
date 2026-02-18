import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agentMembers, AGENT_ROLE_LEVELS } from "@/db/schema";
import type { AgentRole } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: agentId, memberId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { role } = body as { role: string };

  if (!role || !["viewer", "editor", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Look up target member
  const [target] = await db
    .select()
    .from(agentMembers)
    .where(
      and(eq(agentMembers.id, memberId), eq(agentMembers.agentId, agentId))
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot change owner's role
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 403 });
  }

  // Cannot change own role
  if (target.userId === ctx.user.id) {
    return NextResponse.json({ error: "Cannot change own role" }, { status: 403 });
  }

  // Admin cannot set to owner
  if (role === "owner") {
    return NextResponse.json({ error: "Cannot assign owner role" }, { status: 403 });
  }

  // Admin cannot change other admins (only owner can)
  if (
    ctx.role !== "owner" &&
    !ctx.isSuperAdmin &&
    AGENT_ROLE_LEVELS[target.role] >= AGENT_ROLE_LEVELS[ctx.role as AgentRole]
  ) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const [updated] = await db
    .update(agentMembers)
    .set({ role: role as AgentRole, updatedAt: new Date() })
    .where(eq(agentMembers.id, memberId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: agentId, memberId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  // Look up target member
  const [target] = await db
    .select()
    .from(agentMembers)
    .where(
      and(eq(agentMembers.id, memberId), eq(agentMembers.agentId, agentId))
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot remove owner
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove owner" }, { status: 403 });
  }

  // Admin cannot remove other admins (only owner can)
  if (
    ctx.role !== "owner" &&
    !ctx.isSuperAdmin &&
    AGENT_ROLE_LEVELS[target.role] >= AGENT_ROLE_LEVELS[ctx.role as AgentRole]
  ) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  await db
    .delete(agentMembers)
    .where(eq(agentMembers.id, memberId));

  return NextResponse.json({ ok: true });
}
