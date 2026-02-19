import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { executeBuildChatStream } from "@/lib/build-chat/execute-stream";

export const maxDuration = 60;

export async function POST(req: Request) {
  const {
    messages,
    agentId,
  }: {
    messages: UIMessage[];
    agentId?: string;
  } = await req.json();

  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "agentId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Auth: require editor access to the agent
  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  return executeBuildChatStream({ messages, agentId });
}
