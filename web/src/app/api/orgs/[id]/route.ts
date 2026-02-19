import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { toSlug } from "@/lib/agents/slug";

/**
 * Ensure the slug is unique across all orgs (excluding current org).
 */
async function ensureUniqueOrgSlug(
  base: string,
  excludeId: string
): Promise<string> {
  const { ne } = await import("drizzle-orm");
  let candidate = base;
  let suffix = 2;

  while (true) {
    const [existing] = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.slug, candidate))
      .limit(1);

    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireOrgRole(id, "member");
  if (ctx instanceof NextResponse) return ctx;

  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.id, id))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  return NextResponse.json(org);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireOrgRole(id, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { name, slug, avatarUrl } = body as {
    name?: string;
    slug?: string;
    avatarUrl?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  if (slug !== undefined) {
    const baseSlug = slug.trim() || toSlug(name ?? "");
    updates.slug = await ensureUniqueOrgSlug(baseSlug, id);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [org] = await db
    .update(orgs)
    .set(updates)
    .where(eq(orgs.id, id))
    .returning();

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  return NextResponse.json(org);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireOrgRole(id, "owner");
  if (ctx instanceof NextResponse) return ctx;

  // Cannot delete personal orgs
  const [org] = await db
    .select({ isPersonal: orgs.isPersonal })
    .from(orgs)
    .where(eq(orgs.id, id))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  if (org.isPersonal) {
    return NextResponse.json(
      { error: "Cannot delete personal org" },
      { status: 403 }
    );
  }

  await db.delete(orgs).where(eq(orgs.id, id));
  return NextResponse.json({ ok: true });
}
