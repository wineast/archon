import { db } from "@/db";
import { agents, agentMembers, agentVersions, orgMembers, orgs } from "@/db/schema";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { toSlug, ensureUniqueSlug } from "@/lib/agents/slug";
import { requireAuth } from "@/lib/auth/require-agent-role";
import { requireOrgRole } from "@/lib/auth/require-org-role";

export async function GET(req: Request) {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");

  if (user.platformRole === "super_admin") {
    const conditions = orgId ? [eq(agents.orgId, orgId)] : [];
    const rows = await db
      .select()
      .from(agents)
      .where(and(isNull(agents.deletedAt), ne(agents.scope, "platform"), ...(conditions.length ? conditions : [])))
      .orderBy(desc(agents.updatedAt));

    // Fetch org slugs for all agents
    const orgIds = [...new Set(rows.map((r) => r.orgId))];
    const orgRows = orgIds.length
      ? await db.select({ id: orgs.id, slug: orgs.slug }).from(orgs).where(sql`${orgs.id} IN ${orgIds}`)
      : [];
    const orgSlugMap = Object.fromEntries(orgRows.map((o) => [o.id, o.slug]));

    return NextResponse.json(
      rows.map((r) => ({ ...r, myRole: "owner" as const, orgSlug: orgSlugMap[r.orgId] ?? "" }))
    );
  }

  // Normal user: agents where they are a member + public agents (optionally filtered by org)
  const baseConditions = orgId
    ? [eq(agents.orgId, orgId)]
    : [];

  const rows = await db
    .select({
      id: agents.id,
      orgId: agents.orgId,
      name: agents.name,
      description: agents.description,
      icon: agents.icon,
      slug: agents.slug,
      isPublic: agents.isPublic,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      myRole: sql<string>`coalesce(${agentMembers.role}, 'viewer')`.as("my_role"),
      orgSlug: sql<string>`${orgs.slug}`.as("org_slug"),
    })
    .from(agents)
    .innerJoin(orgs, eq(orgs.id, agents.orgId))
    .leftJoin(
      agentMembers,
      sql`${agentMembers.agentId} = ${agents.id} AND ${agentMembers.userId} = ${user.id}`
    )
    .leftJoin(
      orgMembers,
      sql`${orgMembers.orgId} = ${agents.orgId} AND ${orgMembers.userId} = ${user.id}`
    )
    .where(
      and(
        isNull(agents.deletedAt),
        ne(agents.scope, "platform"),
        or(
          eq(agentMembers.userId, user.id),
          sql`${orgMembers.userId} IS NOT NULL`,
          eq(agents.isPublic, true)
        ),
        ...(baseConditions.length ? baseConditions : [])
      )
    )
    .orderBy(desc(agents.updatedAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  const body = await req.json();
  const { name, description, icon, orgId } = body as {
    name: string;
    description?: string;
    icon?: string;
    orgId: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  // Verify user has admin+ role in the org
  const orgCtx = await requireOrgRole(orgId, "admin");
  if (orgCtx instanceof NextResponse) return orgCtx;

  const baseSlug = body.slug?.trim() || toSlug(name);
  const slug = await ensureUniqueSlug(baseSlug, orgId);

  const [agent] = await db
    .insert(agents)
    .values({
      orgId,
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

  // Auto-create initial version 0.1.0
  const { buildSnapshot } = await import("@/lib/versions/snapshot");
  const snapshot = await buildSnapshot(agent.id);
  const [initialVersion] = await db
    .insert(agentVersions)
    .values({
      agentId: agent.id,
      version: "0.1.0",
      changelog: "Initial version",
      snapshot,
      createdBy: user.id,
    })
    .returning();

  const updatedAgent = await db
    .update(agents)
    .set({
      editingVersionId: initialVersion.id,
      publishedVersionId: initialVersion.id,
    })
    .where(eq(agents.id, agent.id))
    .returning()
    .then((rows) => rows[0]);

  // Get org slug for response
  const [org] = await db
    .select({ slug: orgs.slug })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return NextResponse.json(
    { ...(updatedAgent ?? agent), myRole: "owner" as const, orgSlug: org?.slug ?? "" },
    { status: 201 }
  );
}
