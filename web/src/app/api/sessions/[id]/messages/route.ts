import { getSession, getSessionMessages } from "@/db/chat-persistence";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { AGENT_ROLE_LEVELS } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!session.agentId) {
    return NextResponse.json({ error: "Session has no agent" }, { status: 400 });
  }

  const ctx = await requireAgentRole(session.agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  // Viewer/Editor can only see their own sessions
  if (
    AGENT_ROLE_LEVELS[ctx.role] < AGENT_ROLE_LEVELS["admin"] &&
    session.userId &&
    session.userId !== ctx.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const msgs = await getSessionMessages(id);
  return NextResponse.json(msgs);
}
