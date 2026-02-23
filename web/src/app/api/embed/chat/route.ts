import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireEmbedToken } from "@/lib/auth/require-embed-token";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { executeChatStream } from "@/lib/chat/execute-stream";

export const maxDuration = 30;

export async function POST(req: Request) {
  // Clone body for potential re-read (embed token check consumes headers only)
  const body: {
    messages: UIMessage[];
    sessionId?: string;
    hostContext?: Record<string, unknown>;
    registeredHostTools?: string[];
    agentId?: string;
  } = await req.json();

  let agentId: string;
  let userId: string | null;

  // Dual auth: try embed token first, then Clerk session
  const authHeader = req.headers.get("authorization");
  const hasEmbedToken = authHeader?.startsWith("Bearer et_");

  if (hasEmbedToken) {
    // Embed token path
    const ctx = await requireEmbedToken(req);
    if (ctx instanceof NextResponse) return ctx;
    agentId = ctx.agent.id;
    userId = null;
  } else {
    // Clerk session path (for internal assist mode)
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!body.agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    // Verify user has viewer access to this agent
    const roleResult = await requireAgentRole(body.agentId, "viewer");
    if (roleResult instanceof NextResponse) return roleResult;
    agentId = body.agentId;
    userId = roleResult.user.id;
  }

  return executeChatStream({
    messages: body.messages,
    sessionId: body.sessionId,
    agentId,
    userId,
    hostContext: body.hostContext,
    registeredHostTools: body.registeredHostTools,
  });
}
