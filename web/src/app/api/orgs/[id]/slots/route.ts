import { NextResponse } from "next/server";
import { db } from "@/db";
import { orgSlots, agents, SLOT_KEYS } from "@/db/schema";
import type { SlotKey } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { invalidateSlotCache } from "@/lib/slots";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const ctx = await requireOrgRole(orgId, "member");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select({
      id: orgSlots.id,
      slotKey: orgSlots.slotKey,
      agentId: orgSlots.agentId,
      agentName: agents.name,
      agentSlug: agents.slug,
      agentIcon: agents.icon,
    })
    .from(orgSlots)
    .innerJoin(agents, eq(agents.id, orgSlots.agentId))
    .where(eq(orgSlots.orgId, orgId));

  return NextResponse.json(rows);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { slotKey, agentId } = body as { slotKey: SlotKey; agentId: string };

  if (!slotKey || !(SLOT_KEYS as readonly string[]).includes(slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const [row] = await db
    .insert(orgSlots)
    .values({ orgId, slotKey, agentId })
    .onConflictDoUpdate({
      target: [orgSlots.orgId, orgSlots.slotKey],
      set: { agentId, updatedAt: new Date() },
      where: and(eq(orgSlots.orgId, orgId), eq(orgSlots.slotKey, slotKey)),
    })
    .returning();

  invalidateSlotCache();

  return NextResponse.json(row);
}
