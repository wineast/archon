import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { restoreSnapshot } from "@/lib/versions/snapshot";
import type { AgentSnapshot } from "@/lib/versions/types";

type Params = Promise<{ id: string; versionId: string }>;

/** POST — rollback to a specific version */
export async function POST(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { id: agentId, versionId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const [version] = await db
    .select({ snapshot: agentVersions.snapshot })
    .from(agentVersions)
    .where(eq(agentVersions.id, versionId))
    .limit(1);

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const snapshot = version.snapshot as AgentSnapshot;

  await db.transaction(async (tx) => {
    await restoreSnapshot(agentId, snapshot, tx);
  });

  return NextResponse.json({ ok: true });
}
