import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
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
    [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.slug, id))
      .limit(1);
  } else {
    [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
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

  const body = await req.json();
  const { name, description, icon, slug, isPublic } = body as {
    name?: string;
    description?: string;
    icon?: string;
    slug?: string;
    isPublic?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (icon !== undefined) updates.icon = icon;
  if (typeof isPublic === "boolean") updates.isPublic = isPublic;

  if (slug !== undefined) {
    const baseSlug = slug.trim() || toSlug(name ?? "");
    updates.slug = await ensureUniqueSlug(baseSlug, id);
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

  await db.delete(agents).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
