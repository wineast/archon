import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { buildSnapshot, restoreSnapshot } from "@/lib/versions/snapshot";
import type { AgentSnapshot } from "@/lib/versions/types";

/**
 * POST — switch the editing version.
 *
 * 1. Auto-save current live data back to the currently-editing version's snapshot
 * 2. Restore the target version's snapshot into the live resource tables
 * 3. Update agents.editingVersionId
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

  // Load agent + target version
  const [[agent], [targetVersion]] = await Promise.all([
    db.select().from(agents).where(eq(agents.id, agentId)).limit(1),
    db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.id, targetVersionId))
      .limit(1),
  ]);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (!targetVersion) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Already editing this version — no-op
  if (agent.editingVersionId === targetVersionId) {
    return NextResponse.json({ ok: true });
  }

  await db.transaction(async (tx) => {
    // 1. Auto-save current state to the currently-editing version
    if (agent.editingVersionId) {
      const currentSnapshot = await buildSnapshot(agentId);
      await tx
        .update(agentVersions)
        .set({ snapshot: currentSnapshot })
        .where(eq(agentVersions.id, agent.editingVersionId));
    }

    // 2. Restore target version's snapshot
    const targetSnapshot = targetVersion.snapshot as AgentSnapshot;
    await restoreSnapshot(agentId, targetSnapshot, tx);

    // 3. Update editing pointer
    await tx
      .update(agents)
      .set({ editingVersionId: targetVersionId })
      .where(eq(agents.id, agentId));
  });

  return NextResponse.json({ ok: true });
}
