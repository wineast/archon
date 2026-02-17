import { getSessionMessages } from "@/db/chat-persistence";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const msgs = await getSessionMessages(id);
  return NextResponse.json(msgs);
}
