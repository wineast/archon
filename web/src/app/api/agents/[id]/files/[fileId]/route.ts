import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { agentFiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;

  const ctx = await requireAgentRole(id, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .select()
    .from(agentFiles)
    .where(and(eq(agentFiles.id, fileId), eq(agentFiles.agentId, id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await del(row.url);
  await db.delete(agentFiles).where(eq(agentFiles.id, fileId));

  return NextResponse.json({ ok: true });
}
