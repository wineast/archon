import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { executeChatStream } from "@/lib/chat/execute-stream";
import { resolvePublishedVersionId, resolveEditingVersionId, validateVersionBelongsToAgent } from "@/lib/versions/resolve";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    sessionId,
    agentId,
    draft,
    source,
    versionId: requestVersionId,
  }: {
    messages: UIMessage[];
    sessionId?: string;
    agentId?: string;
    draft?: boolean;
    source?: string;
    versionId?: string;
  } = await req.json();

  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "agentId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Version chat: specific versionId provided
  if (requestVersionId) {
    const ctx = await requireAgentRole(agentId, "viewer");
    if (ctx instanceof NextResponse) return ctx;

    const valid = await validateVersionBelongsToAgent(agentId, requestVersionId);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "version_not_found", message: "Version not found for this agent" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return executeChatStream({
      messages,
      sessionId,
      agentId,
      userId: ctx.user.id,
      versionId: requestVersionId,
      source: source ?? `version:${requestVersionId}`,
    });
  }

  if (draft) {
    // Draft preview requires editor role
    const ctx = await requireAgentRole(agentId, "editor");
    if (ctx instanceof NextResponse) return ctx;

    const versionId = await resolveEditingVersionId(agentId);
    return executeChatStream({
      messages,
      sessionId,
      agentId,
      userId: ctx.user.id,
      versionId,
      source: source ?? "preview",
    });
  }

  // Published mode (default) — require viewer access
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  let versionId: string;
  try {
    versionId = await resolvePublishedVersionId(agentId);
  } catch {
    return new Response(
      JSON.stringify({ error: "not_published", message: "Agent has no published version" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  return executeChatStream({
    messages,
    sessionId,
    agentId,
    userId: ctx.user.id,
    versionId,
    source: source ?? "chat",
  });
}
