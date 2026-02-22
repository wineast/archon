import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

type Params = Promise<{ id: string; versionId: string }>;

/** POST — publish a version (just update the pointer) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { id: agentId, versionId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  // Verify version exists
  const [version] = await db
    .select({ id: agentVersions.id })
    .from(agentVersions)
    .where(eq(agentVersions.id, versionId))
    .limit(1);

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Update published pointer (resources accessed via versionId, no snapshot needed)
  await db
    .update(agents)
    .set({ publishedVersionId: versionId })
    .where(eq(agents.id, agentId));

  return NextResponse.json({ ok: true });
}
