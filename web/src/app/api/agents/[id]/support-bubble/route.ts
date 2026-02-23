import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, embedTokens } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveOrgSlot } from "@/lib/slots";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  // Look up agent's orgId
  const [agent] = await db
    .select({ orgId: agents.orgId })
    .from(agents)
    .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
    .limit(1);

  if (!agent) return NextResponse.json(null);

  // Resolve org-level support slot
  const resolved = await resolveOrgSlot(agent.orgId, "support");
  if (!resolved.agentId) return NextResponse.json(null);

  // Find first active embed token for the support agent
  const [token] = await db
    .select({ token: embedTokens.token })
    .from(embedTokens)
    .where(
      and(eq(embedTokens.agentId, resolved.agentId), eq(embedTokens.isActive, true))
    )
    .limit(1);

  if (!token) return NextResponse.json(null);

  return NextResponse.json({ agentId: resolved.agentId, token: token.token });
}
