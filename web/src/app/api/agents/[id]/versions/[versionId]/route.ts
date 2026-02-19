import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentVersions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

type Params = Promise<{ id: string; versionId: string }>;

/** GET — version detail (with snapshot) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { id: agentId, versionId } = await params;
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .select({
      id: agentVersions.id,
      agentId: agentVersions.agentId,
      version: agentVersions.version,
      changelog: agentVersions.changelog,
      snapshot: agentVersions.snapshot,
      createdBy: agentVersions.createdBy,
      createdAt: agentVersions.createdAt,
      creatorNickname: users.nickname,
      creatorEmail: users.email,
    })
    .from(agentVersions)
    .leftJoin(users, eq(agentVersions.createdBy, users.id))
    .where(eq(agentVersions.id, versionId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

/** DELETE — delete a version */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { id: agentId, versionId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  // Prevent deleting the published version
  const [agent] = await db
    .select({ publishedVersionId: agents.publishedVersionId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (agent?.publishedVersionId === versionId) {
    return NextResponse.json(
      { error: "Cannot delete the published version" },
      { status: 400 }
    );
  }

  await db.delete(agentVersions).where(eq(agentVersions.id, versionId));

  return NextResponse.json({ ok: true });
}
