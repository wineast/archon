import {
  getSession,
  updateSessionTitle,
  deleteSession,
} from "@/db/chat-persistence";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { title } = await req.json();
  const session = await updateSessionTitle(id, title);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
