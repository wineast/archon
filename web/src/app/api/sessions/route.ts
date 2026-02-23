import { listSessions, listSessionsByUser } from "@/db/chat-persistence";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { AGENT_ROLE_LEVELS } from "@/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  const showAll = url.searchParams.get("all") === "true";
  const source = url.searchParams.get("source") ?? "chat";

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  // Admin+ can see all sessions if requested
  if (showAll && AGENT_ROLE_LEVELS[ctx.role] >= AGENT_ROLE_LEVELS["admin"]) {
    const sessions = await listSessions(50, agentId, source);
    return NextResponse.json(sessions);
  }

  // Default: user's own sessions only
  const sessions = await listSessionsByUser(50, agentId, ctx.user.id, source);
  return NextResponse.json(sessions);
}
