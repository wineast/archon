import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agentMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "owner");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { targetUserId } = body as { targetUserId: string };

  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  if (targetUserId === ctx.user.id) {
    return NextResponse.json({ error: "Cannot transfer to yourself" }, { status: 400 });
  }

  // Check target is a member
  const [targetMember] = await db
    .select()
    .from(agentMembers)
    .where(
      and(eq(agentMembers.agentId, agentId), eq(agentMembers.userId, targetUserId))
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member" }, { status: 404 });
  }

  // Transaction: set target as owner, set current user as admin
  await db.transaction(async (tx) => {
    await tx
      .update(agentMembers)
      .set({ role: "owner", updatedAt: new Date() })
      .where(
        and(eq(agentMembers.agentId, agentId), eq(agentMembers.userId, targetUserId))
      );

    await tx
      .update(agentMembers)
      .set({ role: "admin", updatedAt: new Date() })
      .where(
        and(eq(agentMembers.agentId, agentId), eq(agentMembers.userId, ctx.user.id))
      );
  });

  return NextResponse.json({ ok: true });
}
