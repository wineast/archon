import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { requireEmbedToken } from "@/lib/auth/require-embed-token";
import { executeChatStream } from "@/lib/chat/execute-stream";

export const maxDuration = 30;

export async function POST(req: Request) {
  const ctx = await requireEmbedToken(req);
  if (ctx instanceof NextResponse) return ctx;

  const {
    messages,
    sessionId,
  }: {
    messages: UIMessage[];
    sessionId?: string;
  } = await req.json();

  return executeChatStream({
    messages,
    sessionId,
    agentId: ctx.agent.id,
    userId: null,
  });
}
