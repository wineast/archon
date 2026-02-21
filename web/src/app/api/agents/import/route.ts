import { db } from "@/db";
import { agents, agentMembers, agentVersions, orgs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureUniqueSlug } from "@/lib/agents/slug";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { restoreSnapshot } from "@/lib/versions/snapshot";
import { validateExportData } from "@/lib/versions/types";
import type { AgentSnapshot } from "@/lib/versions/types";

/** POST — import agent from exported JSON */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const orgCtx = await requireOrgRole(orgId, "member");
  if (orgCtx instanceof NextResponse) return orgCtx;

  const body: unknown = await req.json();

  if (!validateExportData(body)) {
    return NextResponse.json(
      { error: "Invalid export file format" },
      { status: 400 }
    );
  }

  const slug = await ensureUniqueSlug(
    body.agent.slug || "imported-agent",
    orgId
  );

  const result = await db.transaction(async (tx) => {
    // 1. Create agent
    const [agent] = await tx
      .insert(agents)
      .values({
        orgId,
        name: body.agent.name,
        description: body.agent.description ?? "",
        icon: body.agent.icon ?? "bot",
        slug,
        isPublic: body.agent.isPublic ?? false,
        mcpEnabled: body.agent.mcpEnabled ?? true,
        memoryEnabled: body.agent.memoryEnabled ?? false,
        skillsEnabled: body.agent.skillsEnabled ?? true,
      })
      .returning();

    // 2. Add creator as owner
    await tx.insert(agentMembers).values({
      agentId: agent.id,
      userId: orgCtx.user.id,
      role: "owner",
    });

    // 3. Insert all versions, track editing/published pointers
    let editingVersionId: string | null = null;
    let publishedVersionId: string | null = null;
    let editingSnapshot: AgentSnapshot | null = null;

    for (const v of body.versions) {
      const [inserted] = await tx
        .insert(agentVersions)
        .values({
          agentId: agent.id,
          version: v.version,
          changelog: v.changelog ?? "",
          snapshot: v.snapshot,
          createdBy: orgCtx.user.id,
        })
        .returning();

      if (v.isEditing) {
        editingVersionId = inserted.id;
        editingSnapshot = v.snapshot;
      }
      if (v.isPublished) {
        publishedVersionId = inserted.id;
      }
    }

    // Fallback: if no version marked, use the last one
    if (!editingVersionId || !publishedVersionId) {
      const lastVersion = body.versions[body.versions.length - 1];
      // Re-fetch the last inserted version's id
      const allVersions = await tx
        .select({ id: agentVersions.id, version: agentVersions.version })
        .from(agentVersions)
        .where(eq(agentVersions.agentId, agent.id));
      const lastInserted = allVersions.find(
        (v) => v.version === lastVersion.version
      );
      if (!editingVersionId && lastInserted) {
        editingVersionId = lastInserted.id;
        editingSnapshot = lastVersion.snapshot;
      }
      if (!publishedVersionId && lastInserted) {
        publishedVersionId = lastInserted.id;
      }
    }

    // 4. Update version pointers
    await tx
      .update(agents)
      .set({ editingVersionId, publishedVersionId })
      .where(eq(agents.id, agent.id));

    // 5. Restore editing version's snapshot into live resource tables
    if (editingSnapshot) {
      await restoreSnapshot(agent.id, editingSnapshot, tx);
    }

    return agent;
  });

  // Get org slug for response
  const [org] = await db
    .select({ slug: orgs.slug })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return NextResponse.json(
    { ...result, myRole: "owner" as const, orgSlug: org?.slug ?? "" },
    { status: 201 }
  );
}
