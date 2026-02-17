import { listSessions } from "@/db/chat-persistence";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const sessions = await listSessions(50, agentId);
  return NextResponse.json(sessions);
}
