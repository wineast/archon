import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveAgentSlot } from "@/lib/slots";

/** GET ?agentId=X — resolve evaluator slot to get judge agent info */
export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const resolved = await resolveAgentSlot(agentId, "evaluator");

  if (!resolved.agentId) {
    return NextResponse.json({ judgeAgentId: null, judgeAgentName: null, judgeAgentSlug: null });
  }

  const [agent] = await db
    .select({ name: agents.name, slug: agents.slug })
    .from(agents)
    .where(eq(agents.id, resolved.agentId))
    .limit(1);

  return NextResponse.json({
    judgeAgentId: resolved.agentId,
    judgeAgentName: agent?.name ?? null,
    judgeAgentSlug: agent?.slug ?? null,
  });
}
