import { NextResponse, type NextRequest } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { buildSnapshot } from "@/lib/versions/snapshot";
import { computeSnapshotDiff, buildDiffSummary } from "@/lib/versions/diff";

type Params = Promise<{ id: string }>;

/**
 * GET /api/agents/[id]/versions/diff?from=<versionId>&to=<versionId>
 *
 * Computes the diff between two version snapshots.
 * Both `from` and `to` must be valid version IDs for this agent.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = req.nextUrl;
  const fromVersionId = searchParams.get("from");
  const toVersionId = searchParams.get("to");

  if (!fromVersionId || !toVersionId) {
    return NextResponse.json(
      { error: "Both 'from' and 'to' version IDs are required" },
      { status: 400 }
    );
  }

  if (fromVersionId === toVersionId) {
    return NextResponse.json(
      { error: "Cannot diff a version with itself" },
      { status: 400 }
    );
  }

  try {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      buildSnapshot(agentId, fromVersionId),
      buildSnapshot(agentId, toVersionId),
    ]);

    const diff = computeSnapshotDiff(fromSnapshot, toSnapshot);
    const summary = buildDiffSummary(diff);

    return NextResponse.json({ diff, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to compute diff";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
