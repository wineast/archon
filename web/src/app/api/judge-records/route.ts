import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalRuns, agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

/** GET ?judgeAgentId=X — query evalRuns where judgeAgentId = X, grouped by agentId */
export async function GET(req: Request) {
  const judgeAgentId = new URL(req.url).searchParams.get("judgeAgentId");
  if (!judgeAgentId) {
    return NextResponse.json({ error: "judgeAgentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(judgeAgentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const runs = await db
    .select({
      id: evalRuns.id,
      agentId: evalRuns.agentId,
      chatModel: evalRuns.chatModel,
      totalCases: evalRuns.totalCases,
      passedAssertions: evalRuns.passedAssertions,
      averageScore: evalRuns.averageScore,
      createdAt: evalRuns.createdAt,
    })
    .from(evalRuns)
    .where(eq(evalRuns.judgeAgentId, judgeAgentId))
    .orderBy(evalRuns.createdAt);

  // Group by agentId with agent names
  const agentIds = [...new Set(runs.map((r) => r.agentId).filter(Boolean))] as string[];
  const agentRows = agentIds.length > 0
    ? await Promise.all(agentIds.map(async (id) => {
        const [a] = await db.select({ id: agents.id, name: agents.name, slug: agents.slug }).from(agents).where(eq(agents.id, id)).limit(1);
        return a;
      }))
    : [];

  const agentMap = Object.fromEntries(agentRows.filter(Boolean).map((a) => [a.id, a]));

  const grouped = agentIds.map((agentId) => ({
    agentId,
    agentName: agentMap[agentId]?.name ?? "Unknown",
    agentSlug: agentMap[agentId]?.slug ?? "",
    runs: runs.filter((r) => r.agentId === agentId),
  }));

  return NextResponse.json(grouped);
}
