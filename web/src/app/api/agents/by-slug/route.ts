import { db } from "@/db";
import { agents, orgs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("org");
  const agentSlug = url.searchParams.get("agent");

  if (!orgSlug || !agentSlug) {
    return NextResponse.json(
      { error: "Both 'org' and 'agent' query params are required" },
      { status: 400 }
    );
  }

  const [row] = await db
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
      orgSlug: orgs.slug,
    })
    .from(agents)
    .innerJoin(orgs, eq(orgs.id, agents.orgId))
    .where(and(eq(orgs.slug, orgSlug), eq(agents.slug, agentSlug)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(row.id, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(row);
}
