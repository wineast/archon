import JSZip from "jszip";
import { del, put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { agents, agentFiles, agentMembers, agentVersions, embedTokens, orgs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureUniqueSlug } from "@/lib/agents/slug";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { restoreSnapshot } from "@/lib/versions/snapshot";
import { validateExportData, type AgentExportData } from "@/lib/versions/types";
import { migrateExportData } from "@/lib/versions/migrations";

export const maxDuration = 60;

/** Parse ZIP body → manifest + zip handle */
async function parseZipBody(
  raw: ArrayBuffer
): Promise<{ data: AgentExportData; zip: JSZip }> {
  const zip = await JSZip.loadAsync(raw);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("ZIP missing manifest.json");
  const manifestText = await manifestFile.async("text");
  return { data: JSON.parse(manifestText), zip };
}

/** POST — import agent from exported ZIP */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const orgCtx = await requireOrgRole(orgId, "member");
  if (orgCtx instanceof NextResponse) return orgCtx;

  // Read blobUrl from JSON body (ZIP was uploaded directly to Vercel Blob by the client)
  let blobUrl: string;
  try {
    const json = await req.json();
    blobUrl = json.blobUrl;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
  if (!blobUrl || typeof blobUrl !== "string") {
    return NextResponse.json(
      { error: "blobUrl is required" },
      { status: 400 }
    );
  }

  let body: AgentExportData;
  let zip: JSZip;
  try {
    const blobRes = await fetch(blobUrl);
    if (!blobRes.ok) {
      throw new Error(`Blob fetch failed: ${blobRes.status}`);
    }
    const raw = await blobRes.arrayBuffer();
    ({ data: body, zip } = await parseZipBody(raw));
  } catch {
    await del(blobUrl).catch(() => {});
    return NextResponse.json(
      { error: "Invalid export file format" },
      { status: 400 }
    );
  }

  if (!validateExportData(body)) {
    return NextResponse.json(
      { error: "Invalid export file format" },
      { status: 400 }
    );
  }

  // Migrate old format to current version
  body = migrateExportData(body as unknown as Record<string, unknown>) as unknown as AgentExportData;

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
        description: body.agent.description,
        icon: body.agent.icon,
        slug,
        isPublic: body.agent.isPublic,
        mcpEnabled: body.agent.mcpEnabled,
        memoryEnabled: body.agent.memoryEnabled,
        ragEnabled: body.agent.ragEnabled,
        skillsEnabled: body.agent.skillsEnabled,
        contextCompressionEnabled: body.agent.contextCompressionEnabled,
      })
      .returning();

    // 2. Add creator as owner
    await tx.insert(agentMembers).values({
      agentId: agent.id,
      userId: orgCtx.user.id,
      role: "owner",
    });

    // 3. Insert all versions and restore snapshots into resource rows
    let editingVersionId: string | null = null;
    let publishedVersionId: string | null = null;

    for (const v of body.versions) {
      const [inserted] = await tx
        .insert(agentVersions)
        .values({
          agentId: agent.id,
          version: v.version,
          changelog: v.changelog ?? "",
          createdBy: orgCtx.user.id,
        })
        .returning();

      // Restore snapshot into resource rows for this version
      if (v.snapshot) {
        await restoreSnapshot(agent.id, inserted.id, v.snapshot, tx);
      }

      if (v.isEditing) {
        editingVersionId = inserted.id;
      }
      if (v.isPublished) {
        publishedVersionId = inserted.id;
      }
    }

    // Fallback: if no version marked, use the last one
    if (!editingVersionId || !publishedVersionId) {
      const lastVersion = body.versions[body.versions.length - 1];
      const allVersions = await tx
        .select({ id: agentVersions.id, version: agentVersions.version })
        .from(agentVersions)
        .where(eq(agentVersions.agentId, agent.id));
      const lastInserted = allVersions.find(
        (v) => v.version === lastVersion.version
      );
      if (!editingVersionId && lastInserted) {
        editingVersionId = lastInserted.id;
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

    // 5. Restore embed tokens (generate new token values)
    if (body.embedTokens.length > 0) {
      await tx.insert(embedTokens).values(
        body.embedTokens.map((et) => ({
          agentId: agent.id,
          name: et.name,
          token: `et_${nanoid(32)}`,
          allowedOrigins: et.allowedOrigins,
          isActive: et.isActive,
        }))
      );
    }

    // 6. Restore files from ZIP
    if (body.files.length > 0) {
      await Promise.all(
        body.files.map(async (fileMeta) => {
          const zipEntry = zip.file(fileMeta.zipPath);
          if (!zipEntry) return;

          const fileData = await zipEntry.async("nodebuffer");
          const blob = await put(
            `agents/${agent.id}/${fileMeta.name}`,
            fileData,
            { access: "public", contentType: fileMeta.contentType }
          );

          await tx.insert(agentFiles).values({
            agentId: agent.id,
            name: fileMeta.name,
            url: blob.url,
            size: fileMeta.size,
            contentType: fileMeta.contentType,
          });
        })
      );
    }

    return agent;
  });

  // Clean up temporary blob
  await del(blobUrl).catch(() => {});

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
