import { db } from "@/db";
import { agents } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "owner");
  if (ctx instanceof NextResponse) return ctx;

  const [agent] = await db
    .update(agents)
    .set({ deletedAt: null })
    .where(and(eq(agents.id, id), isNotNull(agents.deletedAt)))
    .returning();

  if (!agent) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
