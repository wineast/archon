import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "member");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select({
      id: orgMembers.id,
      userId: orgMembers.userId,
      email: users.email,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      role: orgMembers.role,
      createdAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(orgMembers.createdAt);

  return NextResponse.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { email, role } = body as { email: string; role: string };

  if (!email || !role) {
    return NextResponse.json(
      { error: "email and role required" },
      { status: 400 }
    );
  }

  if (!["member", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
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
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUser.id))
    )
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "User is already a member" },
      { status: 409 }
    );
  }

  const [member] = await db
    .insert(orgMembers)
    .values({
      orgId,
      userId: targetUser.id,
      role: role as "member" | "admin",
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
