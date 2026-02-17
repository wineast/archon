import {
  enableSessionShare,
  disableSessionShare,
} from "@/db/chat-persistence";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await enableSessionShare(id);
  if (!result) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await disableSessionShare(id);
  return NextResponse.json({ success: true });
}
