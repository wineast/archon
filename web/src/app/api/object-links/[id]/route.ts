import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(objectLinks)
    .where(eq(objectLinks.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await db.delete(objectLinks).where(eq(objectLinks.id, id));
  return NextResponse.json({ ok: true });
}
