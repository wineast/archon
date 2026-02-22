import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

/**
 * POST — switch the editing version.
 *
 * In the versionId model, each version's resources live in the DB
 * with their own versionId. Switching just updates the pointer.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { targetVersionId } = body as { targetVersionId: string };

  if (!targetVersionId) {
    return NextResponse.json(
      { error: "targetVersionId required" },
      { status: 400 }
    );
  }

  // Verify target version exists
  const [targetVersion] = await db
    .select({ id: agentVersions.id })
    .from(agentVersions)
    .where(eq(agentVersions.id, targetVersionId))
    .limit(1);

  if (!targetVersion) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Update editing pointer (resources already exist per versionId)
  await db
    .update(agents)
    .set({ editingVersionId: targetVersionId })
    .where(eq(agents.id, agentId));

  return NextResponse.json({ ok: true });
}
