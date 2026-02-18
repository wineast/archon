import {
  getSession,
  updateSessionTitle,
  deleteSession,
} from "@/db/chat-persistence";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { AGENT_ROLE_LEVELS } from "@/db/schema";

/** Check session access: admin+ can access all, viewer/editor only their own */
async function checkSessionAccess(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (!session.agentId) {
    return { error: NextResponse.json({ error: "Session has no agent" }, { status: 400 }) };
  }

  const ctx = await requireAgentRole(session.agentId, "viewer");
  if (ctx instanceof NextResponse) {
    return { error: ctx };
  }

  // Admin+ can access any session for the agent
  if (AGENT_ROLE_LEVELS[ctx.role] >= AGENT_ROLE_LEVELS["admin"]) {
    return { session, ctx };
  }

  // Viewer/Editor can only access their own sessions
  if (session.userId && session.userId !== ctx.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, ctx };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await checkSessionAccess(id);
  if ("error" in result) return result.error;
  return NextResponse.json(result.session);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await checkSessionAccess(id);
  if ("error" in result) return result.error;

  const { title } = await req.json();
  const session = await updateSessionTitle(id, title);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await checkSessionAccess(id);
  if ("error" in result) return result.error;

  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
