import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentVersions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import type { AgentExportData, AgentSnapshot } from "@/lib/versions/types";

/** GET — export agent as JSON (all versions + metadata) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const [[agent], versionRows] = await Promise.all([
    db.select().from(agents).where(eq(agents.id, agentId)).limit(1),
    db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId))
      .orderBy(asc(agentVersions.createdAt)),
  ]);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const exportData: AgentExportData = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    agent: {
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      slug: agent.slug,
      isPublic: agent.isPublic,
      mcpEnabled: agent.mcpEnabled,
      memoryEnabled: agent.memoryEnabled,
      skillsEnabled: agent.skillsEnabled,
    },
    versions: versionRows.map((v) => ({
      version: v.version,
      changelog: v.changelog,
      snapshot: v.snapshot as AgentSnapshot,
      isEditing: v.id === agent.editingVersionId,
      isPublished: v.id === agent.publishedVersionId,
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${agent.slug}.json"`,
    },
  });
}
