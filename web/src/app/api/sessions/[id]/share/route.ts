import {
  getSession,
  enableSessionShare,
  disableSessionShare,
} from "@/db/chat-persistence";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { AGENT_ROLE_LEVELS } from "@/db/schema";

async function checkShareAccess(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) {
    return { error: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }

  if (!session.agentId) {
    return { error: NextResponse.json({ error: "Session has no agent" }, { status: 400 }) };
  }

  const ctx = await requireAgentRole(session.agentId, "viewer");
  if (ctx instanceof NextResponse) {
    return { error: ctx };
  }

  if (
    AGENT_ROLE_LEVELS[ctx.role] < AGENT_ROLE_LEVELS["admin"] &&
    session.userId &&
    session.userId !== ctx.user.id
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, ctx };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const check = await checkShareAccess(id);
  if ("error" in check) return check.error;

  const result = await enableSessionShare(id);
  if (!result) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const check = await checkShareAccess(id);
  if ("error" in check) return check.error;

  await disableSessionShare(id);
  return NextResponse.json({ success: true });
}
