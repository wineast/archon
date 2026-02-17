import { NextResponse } from "next/server";
import { renderSystemPrompt } from "@/lib/template/render";

export async function POST(req: Request) {
  const { text, agentId } = (await req.json()) as {
    text: string;
    agentId: string;
  };

  const rendered = await renderSystemPrompt(text, agentId);
  return NextResponse.json({ rendered });
}
