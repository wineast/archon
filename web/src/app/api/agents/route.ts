import { db } from "@/db";
import { agents, agentMembers } from "@/db/schema";
import { desc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { toSlug, ensureUniqueSlug } from "@/lib/agents/slug";
import { requireAuth } from "@/lib/auth/require-agent-role";

export async function GET() {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  if (user.platformRole === "super_admin") {
    // Super admin sees all agents with role = "owner"
    const rows = await db
      .select()
      .from(agents)
      .orderBy(desc(agents.updatedAt));
    return NextResponse.json(
      rows.map((r) => ({ ...r, myRole: "owner" as const }))
    );
  }

  // Normal user: agents where they are a member + public agents
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
      myRole: sql<string>`coalesce(${agentMembers.role}, 'viewer')`.as(
        "my_role"
      ),
    })
    .from(agents)
    .leftJoin(
      agentMembers,
      sql`${agentMembers.agentId} = ${agents.id} AND ${agentMembers.userId} = ${user.id}`
    )
    .where(or(eq(agentMembers.userId, user.id), eq(agents.isPublic, true)))
    .orderBy(desc(agents.updatedAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  const body = await req.json();
  const { name, description, icon } = body as {
    name: string;
    description?: string;
    icon?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const baseSlug = body.slug?.trim() || toSlug(name);
  const slug = await ensureUniqueSlug(baseSlug);

  const [agent] = await db
    .insert(agents)
    .values({
      name: name.trim(),
      description: description?.trim() ?? "",
      icon: icon ?? "bot",
      slug,
    })
    .returning();

  // Auto-add creator as owner
  await db.insert(agentMembers).values({
    agentId: agent.id,
    userId: user.id,
    role: "owner",
  });

  return NextResponse.json({ ...agent, myRole: "owner" as const }, { status: 201 });
}
