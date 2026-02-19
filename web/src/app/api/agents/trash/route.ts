import { db } from "@/db";
import { agents, agentMembers } from "@/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-agent-role";

export async function GET() {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  if (user.platformRole === "super_admin") {
    const rows = await db
      .select()
      .from(agents)
      .where(isNotNull(agents.deletedAt))
      .orderBy(desc(agents.deletedAt));
    return NextResponse.json(rows);
  }

  // Normal user: only agents where they are owner
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      icon: agents.icon,
      slug: agents.slug,
      isPublic: agents.isPublic,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      deletedAt: agents.deletedAt,
    })
    .from(agents)
    .innerJoin(agentMembers, eq(agentMembers.agentId, agents.id))
    .where(
      and(
        isNotNull(agents.deletedAt),
        eq(agentMembers.userId, user.id),
        eq(agentMembers.role, "owner")
      )
    )
    .orderBy(desc(agents.deletedAt));

  return NextResponse.json(rows);
}
