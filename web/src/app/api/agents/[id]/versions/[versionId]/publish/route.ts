import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { buildSnapshot } from "@/lib/versions/snapshot";

type Params = Promise<{ id: string; versionId: string }>;

/** POST — publish a version (save current state to its snapshot, mark as published) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { id: agentId, versionId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const [version] = await db
    .select()
    .from(agentVersions)
    .where(eq(agentVersions.id, versionId))
    .limit(1);

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Save latest state into this version's snapshot before publishing
  const snapshot = await buildSnapshot(agentId);

  await db.transaction(async (tx) => {
    await tx
      .update(agentVersions)
      .set({ snapshot })
      .where(eq(agentVersions.id, versionId));

    await tx
      .update(agents)
      .set({ publishedVersionId: versionId })
      .where(eq(agents.id, agentId));
  });

  return NextResponse.json({ ok: true });
}
