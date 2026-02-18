import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agentMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select({
      id: agentMembers.id,
      userId: agentMembers.userId,
      email: users.email,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      role: agentMembers.role,
      createdAt: agentMembers.createdAt,
    })
    .from(agentMembers)
    .innerJoin(users, eq(agentMembers.userId, users.id))
    .where(eq(agentMembers.agentId, agentId))
    .orderBy(agentMembers.createdAt);

  return NextResponse.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { email, role } = body as { email: string; role: string };

  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }

  if (!["viewer", "editor", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Admin cannot invite as owner
  if (role === "owner") {
    return NextResponse.json({ error: "Cannot invite as owner" }, { status: 400 });
  }

  // Find user by email
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(agentMembers)
    .where(
      and(eq(agentMembers.agentId, agentId), eq(agentMembers.userId, targetUser.id))
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "User is already a member" }, { status: 409 });
  }

  const [member] = await db
    .insert(agentMembers)
    .values({
      agentId,
      userId: targetUser.id,
      role: role as "viewer" | "editor" | "admin",
    })
    .returning();

  return NextResponse.json({
    id: member.id,
    userId: targetUser.id,
    email: targetUser.email,
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    role: member.role,
    createdAt: member.createdAt,
  });
}
