import { NextResponse } from "next/server";
import { db } from "@/db";
import { orgs, orgMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-agent-role";
import { toSlug } from "@/lib/agents/slug";
import { ensureBuiltinAgents } from "@/lib/builtin-agents/ensure";

/**
 * Ensure the slug is unique across all orgs.
 * If conflict, append -2, -3, etc.
 */
async function ensureUniqueOrgSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;

  while (true) {
    const [existing] = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.slug, candidate))
      .limit(1);

    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

export async function GET() {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  const rows = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      slug: orgs.slug,
      isPersonal: orgs.isPersonal,
      avatarUrl: orgs.avatarUrl,
      createdAt: orgs.createdAt,
      updatedAt: orgs.updatedAt,
      myRole: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, user.id))
    .orderBy(orgs.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  const body = await req.json();
  const { name, slug: rawSlug } = body as { name: string; slug?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const baseSlug = rawSlug?.trim() || toSlug(name);
  const slug = await ensureUniqueOrgSlug(baseSlug);

  const [org] = await db
    .insert(orgs)
    .values({
      name: name.trim(),
      slug,
    })
    .returning();

  // Auto-add creator as owner
  await db.insert(orgMembers).values({
    orgId: org.id,
    userId: user.id,
    role: "owner",
  });

  await ensureBuiltinAgents(org.id);

  return NextResponse.json(
    { ...org, myRole: "owner" as const },
    { status: 201 }
  );
}
