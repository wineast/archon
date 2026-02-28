import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { db } from "@/db";
import { agents, agentFiles, agentVersions, embedTokens } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { buildSnapshot } from "@/lib/versions/snapshot";
import type {
  AgentExportData,
  AgentFileSnapshotItem,
  EmbedTokenSnapshotItem,
} from "@/lib/versions/types";
import { CURRENT_EXPORT_VERSION } from "@/lib/versions/migrations";

/** GET — export agent as ZIP (manifest.json + files/) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const [[agent], versionRows, fileRows, tokenRows] = await Promise.all([
    db.select().from(agents).where(eq(agents.id, agentId)).limit(1),
    db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId))
      .orderBy(asc(agentVersions.createdAt)),
    db
      .select()
      .from(agentFiles)
      .where(eq(agentFiles.agentId, agentId)),
    db
      .select()
      .from(embedTokens)
      .where(eq(embedTokens.agentId, agentId)),
  ]);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Build snapshots on-the-fly from actual resource rows (versionId-based)
  const versions = await Promise.all(
    versionRows.map(async (v) => ({
      version: v.version,
      changelog: v.changelog,
      snapshot: await buildSnapshot(agentId, v.id),
      isEditing: v.id === agent.editingVersionId,
      isPublished: v.id === agent.publishedVersionId,
    }))
  );

  // Download file binaries and build file metadata
  const zip = new JSZip();
  const filesMetadata: AgentFileSnapshotItem[] = [];

  await Promise.all(
    fileRows.map(async (f) => {
      const zipPath = `files/${f.name}`;
      filesMetadata.push({
        name: f.name,
        contentType: f.contentType,
        size: f.size,
        zipPath,
      });
      const res = await fetch(f.url);
      if (res.ok) {
        zip.file(zipPath, await res.arrayBuffer());
      }
    })
  );

  // Map embed tokens (token value excluded for security)
  const embedTokensSnapshot: EmbedTokenSnapshotItem[] = tokenRows.map((t) => ({
    name: t.name,
    allowedOrigins: t.allowedOrigins,
    isActive: t.isActive,
  }));

  const exportData: AgentExportData = {
    exportVersion: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    agent: {
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      slug: agent.slug,
      isPublic: agent.isPublic,
      mcpEnabled: agent.mcpEnabled,
      memoryEnabled: agent.memoryEnabled,
      ragEnabled: agent.ragEnabled,
      skillsEnabled: agent.skillsEnabled,
      contextCompressionEnabled: agent.contextCompressionEnabled,
    },
    versions,
    files: filesMetadata,
    embedTokens: embedTokensSnapshot,
  };

  zip.file("manifest.json", JSON.stringify(exportData, null, 2));

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${agent.slug}.zip"`,
    },
  });
}
