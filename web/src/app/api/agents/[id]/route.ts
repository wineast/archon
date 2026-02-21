import { db } from "@/db";
import { agents, orgs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { toSlug, ensureUniqueSlug } from "@/lib/agents/slug";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(_req.url);
  const by = url.searchParams.get("by");

  let agent;
  if (by === "slug") {
    // Optionally resolve by orgSlug + agentSlug
    const orgSlug = url.searchParams.get("orgSlug");
    if (orgSlug) {
      [agent] = await db
        .select({
          id: agents.id,
          orgId: agents.orgId,
          name: agents.name,
          description: agents.description,
          icon: agents.icon,
          slug: agents.slug,
          isPublic: agents.isPublic,
          memoryEnabled: agents.memoryEnabled,
          editingVersionId: agents.editingVersionId,
          publishedVersionId: agents.publishedVersionId,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
        })
        .from(agents)
        .innerJoin(orgs, eq(orgs.id, agents.orgId))
        .where(and(eq(orgs.slug, orgSlug), eq(agents.slug, id), isNull(agents.deletedAt)))
        .limit(1);
    } else {
      // Legacy: lookup by slug alone (first match)
      [agent] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.slug, id), isNull(agents.deletedAt)))
        .limit(1);
    }
  } else {
    [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), isNull(agents.deletedAt)))
      .limit(1);
  }

  if (!agent) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(agent.id, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(agent);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "admin");
  if (ctx instanceof NextResponse) return ctx;

  // Get agent's orgId for slug uniqueness check
  const [currentAgent] = await db
    .select({ orgId: agents.orgId })
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);

  if (!currentAgent) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, icon, slug, isPublic, memoryEnabled } = body as {
    name?: string;
    description?: string;
    icon?: string;
    slug?: string;
    isPublic?: boolean;
    memoryEnabled?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (icon !== undefined) updates.icon = icon;
  if (typeof isPublic === "boolean") updates.isPublic = isPublic;
  if (typeof memoryEnabled === "boolean") updates.memoryEnabled = memoryEnabled;

  if (slug !== undefined) {
    const baseSlug = slug.trim() || toSlug(name ?? "");
    updates.slug = await ensureUniqueSlug(baseSlug, currentAgent.orgId, id);
  }

  const [agent] = await db
    .update(agents)
    .set(updates)
    .where(eq(agents.id, id))
    .returning();

  if (!agent) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "owner");
  if (ctx instanceof NextResponse) return ctx;

  await db.update(agents).set({ deletedAt: new Date() }).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
