import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, orgs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth/require-agent-role";

export async function GET() {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;

  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      slug: agents.slug,
      icon: agents.icon,
      description: agents.description,
      scope: agents.scope,
      orgSlug: orgs.slug,
      orgName: orgs.name,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .innerJoin(orgs, eq(agents.orgId, orgs.id))
    .where(and(eq(agents.scope, "platform"), isNull(agents.deletedAt)));

  return NextResponse.json(rows);
}
