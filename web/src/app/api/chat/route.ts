import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { executeChatStream } from "@/lib/chat/execute-stream";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    sessionId,
    agentId,
  }: {
    messages: UIMessage[];
    sessionId?: string;
    agentId?: string;
  } = await req.json();

  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "agentId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Auth: require viewer access to the agent
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return executeChatStream({
    messages,
    sessionId,
    agentId,
    userId: ctx.user.id,
  });
}
