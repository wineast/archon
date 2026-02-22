import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agentResourceRefs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

/**
 * PATCH /api/agents/[id]/refs/[refId] — toggle enabled
 * Body: { enabled: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> },
) {
  const { id: agentId, refId } = await params;
  const authResult = await requireAgentRole(agentId, "editor");
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();

  const [updated] = await db
    .update(agentResourceRefs)
    .set({ enabled: body.enabled })
    .where(eq(agentResourceRefs.id, refId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/agents/[id]/refs/[refId] — remove a reference
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> },
) {
  const { id: agentId, refId } = await params;
  const authResult = await requireAgentRole(agentId, "editor");
  if (authResult instanceof NextResponse) return authResult;

  const [deleted] = await db
    .delete(agentResourceRefs)
    .where(eq(agentResourceRefs.id, refId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
