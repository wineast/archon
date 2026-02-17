import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { toSlug, ensureUniqueSlug } from "@/lib/agents/slug";

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
  return NextResponse.json(agent);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, description, icon, slug } = body as {
    name?: string;
    description?: string;
    icon?: string;
    slug?: string;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (icon !== undefined) updates.icon = icon;

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
  await db.delete(agents).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
