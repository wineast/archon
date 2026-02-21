import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agents, embedTokens } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-agent-role";

const SUPPORT_AGENT_SLUG = "archon-support";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  // Find the support agent by slug
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.slug, SUPPORT_AGENT_SLUG), isNull(agents.deletedAt)))
    .limit(1);

  if (!agent) return NextResponse.json(null);

  // Find its first active embed token
  const [token] = await db
    .select({ token: embedTokens.token })
    .from(embedTokens)
    .where(
      and(eq(embedTokens.agentId, agent.id), eq(embedTokens.isActive, true))
    )
    .limit(1);

  if (!token) return NextResponse.json(null);

  return NextResponse.json({ agentId: agent.id, token: token.token });
}
