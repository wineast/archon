import { NextResponse } from "next/server";
import { renderSystemPrompt } from "@/lib/template/render";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function POST(req: Request) {
  const { text, agentId } = (await req.json()) as {
    text: string;
    agentId: string;
  };

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rendered = await renderSystemPrompt(text, agentId);
  return NextResponse.json({ rendered });
}
